import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  createCareer,
  nextUserFixture,
  simulateFixture
} from '../src/career-core/career-core.js';
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
const playerRequestId = playerRequest.id;
const playerId = playerRequest.data.playerId;
const moraleBefore = career.playerState[playerId].morale;
respondToMailboxMessage(career, playerRequestId, 'promise-minutes');
const resolvedPlayerRequest = careerInboxItems(career).find(message => message.id === playerRequestId);
assert.equal(career.playerPromises[playerId].status, 'active');
assert.ok(career.playerState[playerId].morale > moraleBefore);
assert.equal(resolvedPlayerRequest.requiresResponse, false);
assert.equal(resolvedPlayerRequest.status, 'resolved');

const medicalMessage = careerInboxItems(career).find(message => message.kind === 'medical-load');
respondToMailboxMessage(career, medicalMessage.id, 'recovery-plan');
assert.equal(career.trainingFocus, 'Recuperação');
assert.equal(career.medicalPlan.type, 'recovery');

const transferMessage = careerInboxItems(career).find(message => message.kind === 'transfer-offer');
const transferMessageId = transferMessage.id;
const transferOfferId = transferMessage.data.offerId;
const transferPlayerId = transferMessage.data.playerId;
const originalOffer = career.transferOffers[transferOfferId].amount;
respondToMailboxMessage(career, transferMessageId, 'negotiate-offer');
const counterMessage = careerInboxItems(career).find(message =>
  message.kind === 'transfer-offer' && message.requiresResponse && message.data.offerId === transferOfferId
);
assert.ok(counterMessage, 'Negotiation must create a new final decision message');
assert.ok(counterMessage.data.amount > originalOffer, 'Counter offer must improve the fee');
const counterMessageId = counterMessage.id;
const budgetBeforeSale = career.transferBudget;
respondToMailboxMessage(career, counterMessageId, 'accept-offer');
assert.ok(career.transferBudget > budgetBeforeSale, 'Accepting an offer must increase the transfer budget');
assert.equal(career.transferOffers[transferOfferId].status, 'accepted');
assert.equal(career.playerState[transferPlayerId].departurePending, true);
assert.ok(career.transferLedger.some(row => row.playerId === transferPlayerId));
assert.equal(career.lineup.includes(transferPlayerId), false, 'A departing player must leave the selected XI');
assert.equal(careerInboxItems(career).find(message => message.id === counterMessageId).status, 'resolved');

const fixture = nextUserFixture(career);
const result = simulateFixture(career, fixture);
const userSide = fixture.home === career.clubCode ? 'home' : 'away';
const injuryCandidate = result.lineups[userSide][0];
career.playerState[injuryCandidate].condition = 50;
career.results[fixture.id] = result;
reconcileMailbox(career);
const injury = career.injuries[injuryCandidate];
assert.equal(injury.active, true, 'Low-condition player must enter the injury workflow after a match');
assert.equal(career.playerState[injuryCandidate].unavailable, true);
assert.ok(careerInboxItems(career).some(message => message.kind === 'injury' && message.data.playerId === injuryCandidate));
assert.equal(career.lineup.includes(injuryCandidate), false, 'Injured player must be removed from the XI');

career.currentDate = injury.returnDate;
reconcileMailbox(career);
assert.equal(career.injuries[injuryCandidate].active, false, 'Medical return date must clear the injury');
assert.equal(career.playerState[injuryCandidate].unavailable, false);
assert.ok(careerInboxItems(career).some(message => message.kind === 'medical-clearance' && message.data.playerId === injuryCandidate));

const unreadMessage = careerInboxItems(career).find(message => !message.read);
const unreadMessageId = unreadMessage.id;
markMailboxRead(career, unreadMessageId, true);
assert.equal(careerInboxItems(career).find(message => message.id === unreadMessageId).read, true);
markMailboxRead(career, unreadMessageId, false);
assert.equal(careerInboxItems(career).find(message => message.id === unreadMessageId).read, false, 'Messages must be markable as unread');
assert.ok(careerInboxItems(career, { filter: 'transfer' }).every(message => message.category === 'transfer'));
assert.ok(careerInboxItems(career, { query: 'proposta' }).every(message =>
  `${message.sender} ${message.subject} ${message.body}`.toLocaleLowerCase('pt-BR').includes('proposta')
));

const archivedCandidate = careerInboxItems(career).find(message => !message.requiresResponse);
const visibleBeforeArchive = careerInboxItems(career).length;
archivedCandidate.archived = true;
archivedCandidate.read = true;
assert.equal(careerInboxItems(career).length, visibleBeforeArchive - 1, 'Archived messages must disappear from the active mailbox');

const [mailboxSource, mailboxCss, indexSource] = await Promise.all([
  readFile(new URL('../src/career-mailbox.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-mailbox.css', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8')
]);
assert.ok(mailboxSource.includes("const SCREEN_ID = 'touchline-career-mailbox'"), 'Mailbox must render as a dedicated career screen');
assert.ok(mailboxSource.includes('<h1>Mailbox</h1>'), 'Mailbox must use the compact product title');
assert.ok(mailboxSource.includes('tcm-bg'), 'Mailbox must use the club stadium background system');
assert.ok(mailboxSource.includes('data-mail-action'), 'Mailbox decisions must be interactive');
assert.ok(mailboxSource.includes('data-mail-toggle-read'), 'Selected messages must support read and unread control');
assert.ok(mailboxSource.includes('data-mail-delete'), 'Selected messages must support deletion');
assert.ok(mailboxSource.includes('message.archived = true'), 'Deleting a message must persist an archived state');
assert.ok(mailboxSource.includes('message.status = \'dismissed\''), 'Deleting a task must clear its pending state');
assert.ok(mailboxSource.includes('selectMessage'), 'Message selection must update only the selected detail');
assert.ok(mailboxSource.includes('renderListAndDetail'), 'Filters must preserve the fixed mailbox shell');
assert.ok(mailboxSource.includes('dataset.mailConfirming'), 'Destructive choices must use inline confirmation');
assert.ok(mailboxSource.includes('<details class="tcm-filter-menu">'), 'Secondary categories must stay inside one compact filter menu');
assert.equal(mailboxSource.includes('window.confirm'), false, 'Native confirmation dialogs must not interrupt the game UI');
assert.ok(mailboxSource.includes('enhanceHomeMailbox'), 'Home mailbox preview must use the same persisted messages');
assert.ok(mailboxSource.includes('window.__touchlineMailboxSelection'), 'Home message selection must open the same message in the full inbox');
assert.ok(mailboxCss.includes('--tcm-accent: #55c8ff'), 'Mailbox must use the restrained blue visual language');
assert.ok(mailboxCss.includes('.tcm-message-row.is-read:not(.is-selected)'), 'Read messages must be visually quieter');
assert.ok(mailboxCss.includes('.tcm-message-row.is-selected'), 'The active message must have an unmistakable selected state');
assert.ok(mailboxCss.includes('linear-gradient(90deg, rgba(25, 132, 187, .6)'), 'The selected message must use a clear blue highlight');
assert.ok(mailboxCss.includes('font-size: clamp(25px, 2.3vw, 32px)'), 'Message titles must remain contained at desktop sizes');
assert.ok(mailboxCss.includes('grid-template-columns: clamp(330px, 28vw, 410px) minmax(0, 1fr)'), 'Desktop mailbox must preserve list and reading panes');
assert.ok(mailboxCss.includes('@keyframes tcm-detail-in'), 'Detail changes must use a short contained transition');
assert.ok(mailboxCss.includes('prefers-reduced-motion'), 'Mailbox motion must respect reduced-motion preferences');
assert.ok(indexSource.includes('/src/career-mailbox.js'), 'Mailbox enhancer must load in the game runtime');

console.log(JSON.stringify({
  ok: true,
  initialMessages: initialSummary.total,
  initialRequired: initialSummary.required,
  transferNegotiated: true,
  transferAccepted: true,
  injuryCreated: true,
  medicalClearanceCreated: true,
  activeReadUnreadResolvedStates: true,
  persistentDelete: true,
  secondaryFiltersCollapsed: true,
  blueVisualLanguage: true,
  partialDomUpdates: true,
  nativeDialogRemoved: true,
  reducedMotionSupported: true,
  homeAndFullInboxShareData: true
}, null, 2));
