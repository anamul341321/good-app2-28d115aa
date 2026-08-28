/**
 * Ad Boost — উইথড্র প্রতি মাসের ১ তারিখে চালু হয়।
 * ইউজার rewarded অ্যাড দেখে অপেক্ষার সময় কমাতে পারে:
 *   ৫টি অ্যাড = ১ বুস্ট = ৫ দিন কম
 * দিনে সর্বোচ্চ ৫টি অ্যাড (মানে দিনে সর্বোচ্চ ১ বুস্ট = ৫ দিন),
 * এক মাসে সর্বোচ্চ ৫ বুস্ট (২৫ দিন) — অর্থাৎ টানা ৫ দিন অ্যাড দেখলে
 * ২৫ দিন কমে গিয়ে সাথে সাথেই উইথড্র খুলে যাবে।
 */
export const AD_BOOST = {
  adsPerBoost: 5,
  daysPerBoost: 5,
  dailyAdLimit: 5,
  maxBoostsPerCycle: 5,
};

const DAY_MS = 24 * 60 * 60 * 1000;

/** বুস্ট হিসেব করে উইথড্র খোলা আছে কিনা জানায় */
export function adBoostWithdrawInfo(opts: {
  now: number;
  nextFirstAt: number;
  isOpen: boolean;
  boosts: number;
}) {
  const boosts = Math.max(0, Math.min(opts.boosts, AD_BOOST.maxBoostsPerCycle));
  const daysLeft = Math.max(0, Math.ceil((opts.nextFirstAt - opts.now) / DAY_MS));
  const daysCut = boosts * AD_BOOST.daysPerBoost;
  const effectiveDaysLeft = Math.max(0, daysLeft - daysCut);
  return {
    boosts,
    daysLeft,
    daysCut,
    effectiveDaysLeft,
    unlocked: opts.isOpen || effectiveDaysLeft <= 0,
    boostsNeeded: Math.min(
      AD_BOOST.maxBoostsPerCycle,
      Math.ceil(daysLeft / AD_BOOST.daysPerBoost),
    ),
  };
}
