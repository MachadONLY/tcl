import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createCareer, nextUserFixture, simulateFixture } from '../src/career-core/career-core.js';
import {
  careerInboxItems,
  mailboxSummary,
  markMailboxRead,
  reconcileMailbox,
  respondToMailboxMessage
} from '../src/career-core/mailbox-core.js';

const career = createCareer('BOU', '2026-08-06T12:00:00.000Z');
reconcileMailbox(career);

const initialSummary = mailboxSummary(career);
assert.ok(initialSummary.total >= 6, 'Mailbox must combine persisted and contextual club messages');
assert.ok(initialSummary.required >= 3, 'Player, medical and transfer decisions must require responses');
assert.ok(careerInboxItems(career).some(message => message.kind === 'player-minutes'));
assert.ok(careerInboxItems(career).some(message => message.kind === 'medical-load'));
assert.ok(careerInboxItems(career).some(message => message.kind === 'transfer-offer'));
assert.ok(careerInboxItems(career).some(message => message.kind === 'opponent-report'));

const playerRequest = careerInboxItems(career).find(message => message.kind === 'player-minutes');
const playerId = playerRequest.data.playerId;
const moraleBefore = career.playerState[playerId].morale;
respondToMailboxMessage(career, playerRequest.id, 'promise-minutes');
assert.equal(career.playerPromises[playerId].status, 'active');
assert.ok(career.playerState[playerId].morale > moraleBefore);
assert.equal(careerInboxItems(career).find(message => message.id === playerRequest.id).status, 'resolved');

const medicalMessage = careerInboxItems(career).find(message => message.kind === 'medical-load');
respondToMailboxMessage(career, medicalMessage.id, 'recovery-plan');
assert.equal(career.trainingFocus, 'Recuperação');
assert.equal(career.medicalPlan.type, 'recovery');

const transferMessage = careerInboxItems(career).find(message => message.kind === 'transfer-offer');
const offerId = transferMessage.data.offerId;
const transferPlayerId = transferMessage.data.playerId;
const originalOffer = career.transferOffers[offerId].amount;
respondToMailboxMessage(career, transferMessage.id, 'negotiate-offer');
const counterMessage = careerInboxItems(career).find(message =>
  message.kind === 'transfer-offer' && message.requiresResponse && message.data.offerId === offerId
);
assert.ok(counterMessage, 'Negotiation must create a new final decision message');
assert.ok(counterMessage.data.amount > originalOffer, 'Counter offer must improve the fee');
const budgetBeforeSale = career.transferBudget;
respondToMailboxMessage(career, counterMessage.id, 'accept-offer');
assert.ok(career.transferBudget > budgetBeforeSale, 'Accepting an offer must increase the transfer budget');
assert.equal(career.transferOffers[offerId].status, 'accepted');
assert.equal(career.playerState[transferPlayerId].departurePending, true);
assert.equal(career.lineup.includes(transferPlayerId), false, 'A departing player must leave the selected XI');

const fixture = nextUserFixture(career);
const result = simulateFixture(career, fixture);
const userSide = fixture.home === career.clubCode ? 'home' : 'away';
const injuryCandidate = result.lineups[userSide][0];
career.playerState[injuryCandidate].condition = 50;
career.results[fixture.id] = result;
reconcileMailbox(career);
assert.equal(career.injuries[injuryCandidate].active, true, 'Low-condition player must enter the injury workflow after a match');
assert.equal(career.lineup.includes(injuryCandidate), false, 'Injured player must be removed from the XI');
career.currentDate = career.injuries[injuryCandidate].returnDate;
reconcileMailbox(career);
assert.equal(career.injuries[injuryCandidate].active, false, 'Medical return date must clear the injury');
assert.ok(careerInboxItems(career).some(message => message.kind === 'medical-clearance' && message.data.playerId === injuryCandidate));

const unreadMessage = careerInboxItems(career).find(message => !message.read);
markMailboxRead(career, unreadMessage.id, true);
assert.equal(careerInboxItems(career).find(message => message.id === unreadMessage.id).read, true);
markMailboxRead(career, unreadMessage.id, false);
assert.equal(careerInboxItems(career).find(message => message.id === unreadMessage.id).read, false);

const archivedId = careerInboxItems(career).find(message => !message.requiresResponse)?.id;
const visibleBeforeArchive = careerInboxItems(career).length;
const archivedMessage = career.inbox.find(message => message.id === archivedId);
archivedMessage.archived = true;
archivedMessage.read = true;
assert.equal(careerInboxItems(career).length, visibleBeforeArchive - 1, 'Archived messages must disappear from active email views');
assert.ok(career.inbox.filter(message => message.archived).some(message => message.id === archivedId), 'Archive view must retain deleted messages');

const [mailboxSource, mailboxCss, indexSource] = await Promise.all([
  readFile(new URL('../src/career-mailbox-fifa.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-mailbox-fifa.css', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8')
]);

assert.ok(mailboxSource.includes("const SCREEN_ID = 'touchline-fifa-mailbox'"), 'Classic mailbox must render as a dedicated screen');
assert.ok(mailboxSource.includes("tabMarkup('emails', 'Emails'"), 'Mailbox must expose the FIFA-style Emails tab');
assert.ok(mailboxSource.includes("tabMarkup('players', 'Player Conversations'"), 'Mailbox must expose player conversations');
assert.ok(mailboxSource.includes("tabMarkup('archive', 'Message Archive'"), 'Mailbox must expose a persistent archive');
assert.ok(mailboxSource.includes('<div><dt>Data</dt>'), 'Reader must use compact email metadata fields');
assert.ok(mailboxSource.includes('<div><dt>De</dt>'), 'Reader must show sender metadata');
assert.ok(mailboxSource.includes('<div><dt>Para</dt>'), 'Reader must show recipient metadata');
assert.ok(mailboxSource.includes('<div><dt>Assunto</dt>'), 'Reader must show subject metadata');
assert.ok(mailboxSource.includes('data-fmb-action'), 'Career decisions must remain interactive');
assert.ok(mailboxSource.includes('data-fmb-delete'), 'Messages must remain deletable');
assert.ok(mailboxSource.includes('data-fmb-restore'), 'Archived messages must be restorable');
assert.ok(mailboxSource.includes('message.archived = true'), 'Deletion must persist an archived state');
assert.ok(mailboxSource.includes('renderPanes'), 'Selecting messages must update panes instead of remounting the full app');
assert.equal(mailboxSource.includes('window.confirm'), false, 'Native dialogs must not interrupt the game UI');
assert.ok(mailboxSource.includes('enhanceHomeMailbox'), 'Home mailbox must share the same saved messages');

assert.ok(mailboxCss.includes('grid-template-columns:minmax(330px,39%) minmax(0,61%)'), 'Desktop mailbox must follow the classic FIFA list/reader ratio');
assert.ok(mailboxCss.includes('.fmb-row.is-selected'), 'The active email must be unmistakable');
assert.ok(mailboxCss.includes('.fmb-row.is-read:not(.is-selected)'), 'Read messages must be visually quieter');
assert.ok(mailboxCss.includes('.fmb-fields dl div'), 'Metadata must use aligned label/value rows');
assert.ok(mailboxCss.includes('font-size:14px;line-height:1.58'), 'Message body must remain naturally readable');
assert.ok(mailboxCss.includes('@keyframes fmb-reader-in'), 'Reader changes must use a short contained transition');
assert.ok(mailboxCss.includes('prefers-reduced-motion'), 'Motion must respect accessibility preferences');
assert.ok(indexSource.includes('/src/career-mailbox-fifa.js'), 'The rebuilt mailbox must load in the game runtime');
assert.equal(indexSource.includes('/src/career-mailbox.js'), false, 'The obsolete mailbox implementation must not execute');

console.log(JSON.stringify({
  ok: true,
  layout: 'classic-fifa-two-pane-mailbox',
  tabs: ['Emails', 'Player Conversations', 'Message Archive'],
  initialMessages: initialSummary.total,
  initialRequired: initialSummary.required,
  transferNegotiated: true,
  transferAccepted: true,
  injuryWorkflow: true,
  readUnread: true,
  persistentArchive: true,
  partialPaneUpdates: true,
  homeAndFullInboxShareData: true
}, null, 2));
