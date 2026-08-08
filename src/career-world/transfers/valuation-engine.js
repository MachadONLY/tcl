import { daysBetween } from '../world-time.js';

const clamp = (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value));
const roundMoney = value => Math.max(250_000, Math.round(value / 250_000) * 250_000);

export function ageValueMultiplier(age) {
  const years = Number(age) || 24;
  if (years <= 19) return 1.22;
  if (years <= 21) return 1.28;
  if (years <= 24) return 1.2;
  if (years <= 27) return 1.08;
  if (years <= 29) return 0.93;
  if (years === 30) return 0.8;
  if (years === 31) return 0.68;
  if (years === 32) return 0.55;
  if (years === 33) return 0.43;
  if (years === 34) return 0.32;
  if (years === 35) return 0.24;
  return 0.18;
}

export function contractYearsRemaining(contract, date) {
  if (!contract?.endDate) return 2;
  return Math.max(0, daysBetween(date, contract.endDate) / 365.25);
}

function contractMultiplier(years) {
  if (years < 0.5) return 0.48;
  if (years < 1) return 0.6;
  if (years < 2) return 0.78;
  if (years < 3) return 0.94;
  if (years < 4) return 1.05;
  return 1.12;
}

function potentialMultiplier(player) {
  const age = Number(player.age) || 24;
  const gap = Math.max(0, (Number(player.potential) || Number(player.rating) || 70) - (Number(player.rating) || 70));
  if (age >= 27 || !gap) return 1;
  return 1 + Math.min(0.32, gap * (age <= 21 ? 0.035 : age <= 24 ? 0.025 : 0.014));
}

function roleMultiplier(role) {
  return { key: 1.13, important: 1.06, rotation: 0.98, prospect: 1.03, fringe: 0.88 }[role] || 1;
}

export function estimateMarketValue({ player, status = {}, contract = {}, date, sellingClub = {} }) {
  const anchor = Math.max(500_000, Number(player.value) || Math.pow(Math.max(1, Number(player.rating) - 55), 2.1) * 80_000);
  const age = ageValueMultiplier(player.age);
  const contractFactor = contractMultiplier(contractYearsRemaining(contract, date));
  const potential = potentialMultiplier(player);
  const role = roleMultiplier(status.squadRole);
  const clubEconomy = clamp(0.92 + ((Number(sellingClub.elo) || 1750) - 1750) / 1800, 0.88, 1.18);
  const listing = status.transferListed ? 0.9 : 1;
  return roundMoney(anchor * age * contractFactor * potential * role * clubEconomy * listing);
}

export function estimateSellingPosition({ player, status = {}, contract = {}, date, sellingClub = {}, shortage = false }) {
  const marketValue = estimateMarketValue({ player, status, contract, date, sellingClub });
  const years = contractYearsRemaining(contract, date);
  const role = status.squadRole || 'rotation';
  const leverage = years >= 3 ? 1.13 : years < 1 ? 0.82 : 1;
  const importance = role === 'key' ? 1.24 : role === 'important' ? 1.12 : role === 'fringe' ? 0.9 : 1;
  const shortagePremium = shortage ? 1.16 : 1;
  const listFactor = status.transferListed ? 0.94 : 1.06;
  const askingPrice = roundMoney(marketValue * leverage * importance * shortagePremium * listFactor);
  const minimumAcceptableFee = roundMoney(marketValue * (status.transferListed ? 0.82 : role === 'key' ? 1.03 : 0.91) * (years < 1 ? 0.82 : 1));
  return {
    marketValue,
    askingPrice: Math.max(askingPrice, minimumAcceptableFee),
    minimumAcceptableFee: Math.min(Math.max(250_000, minimumAcceptableFee), Math.max(askingPrice, minimumAcceptableFee))
  };
}

export function wageExpectation({ player, contract = {}, buyerClub = {} }) {
  const current = Math.max(1_000, Number(contract.weeklyWage) || Number(player.wage) || 8_000);
  const rating = Number(player.rating) || 70;
  const eloPremium = clamp(1 + ((Number(buyerClub.elo) || 1750) - 1750) / 2500, 0.92, 1.16);
  const abilityPremium = clamp(0.92 + Math.max(0, rating - 74) * 0.018, 0.92, 1.32);
  return Math.round(current * Math.max(1.03, eloPremium * abilityPremium) / 500) * 500;
}

export function transferFeeLooksPlausible(player, fee) {
  const amount = Number(fee) || 0;
  if (amount <= 0) return false;
  const anchor = Math.max(500_000, Number(player.value) || 500_000);
  const ageCap = ageValueMultiplier(player.age) * 2.4;
  return amount <= Math.max(5_000_000, anchor * ageCap);
}
