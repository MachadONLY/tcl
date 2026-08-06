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
assert.ok(careerInboxItems(career, { filter: 'transfer' }).every(message => message.category === 'transfer'));
assert.ok(careerInboxItems(career, { query: 'proposta' }).every(message =>
  `${message.sender} ${message.subject} ${message.body}`.toLocaleLowerCase('pt-BR').includes('proposta')
));

const [mailboxSource, mailboxCss, indexSource] = await Promise.all([
  readFile(new URL('../src/career-mailbox.js', import.meta.url), 'utf8'),
  readFile(new URL('../src/career-mailbox.css', import.meta.url), 'utf8'),
  readFile(new URL('../index.html', import.meta.url), 'utf8')
]);
assert.ok(mailboxSource.includes('tl-mailbox-shell'), 'Full inbox must use a split operational view');
assert.ok(mailboxSource.includes('data-mail-action'), 'Mailbox decisions must be interactive');
assert.ok(mailboxSource.includes('enhanceHomeMailbox'), 'Home mailbox preview must use the same persisted messages');
assert.ok(mailboxSource.includes('window.__touchlineMailboxSelection'), 'Home message selection must open the same message in the full inbox');
assert.ok(mailboxCss.includes('.tl-mail-required-banner'), 'Required decisions must have a prominent visual state');
assert.ok(mailboxCss.includes('grid-template-columns:minmax(330px,410px) minmax(0,1fr)'), 'Desktop inbox must preserve list and detail panes');
assert.ok(indexSource.includes('/src/career-mailbox.js'), 'Mailbox enhancer must load in the game runtime');

console.log(JSON.stringify({
  ok: true,
  initialMessages: initialSummary.total,
  initialRequired: initialSummary.required,
  transferNegotiated: true,
  transferAccepted: true,
  injuryCreated: true,
  medicalClearanceCreated: true,
  homeAndFullInboxShareData: true
}, null, 2));
