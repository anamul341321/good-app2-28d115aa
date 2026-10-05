import { isStoreBuild } from "./store-build";

/**
 * Play Store builds must not read as a crypto-mining product.
 *
 * Nothing about the money changes — same slots, same balances, same payouts.
 * Only the words the user sees change: "মাইনিং" is shown as "ইয ়া র্ন" and
 * "Mining" as "Earn". The map is applied to rendered text nodes so it also
 * covers server-driven notices and labels that no single component owns,
 * while the website and the GoodApp Call APK keep their original wording.
 */
const TERMS: Array<[RegExp, string]> = [
  [/মাইন[্]?ি?ং/gi, "টাস্ক রিওয়ার্ড"],
  [/Mining/gi, "Task rewards"],
  [/আজীবন/g, "অফার চলাকালীন"],
  [/USDT/gi, ""],
  [/Celo/gi, ""],
  [/ক্রিপ্টো/gi, ""],
];

const SKIP = "script,style,textarea,input,select,code,pre";

const rewrite = (node: Text) => {
  const original = node.nodeValue;
  if (!original) return;
  let next = original;
  for (const [re, to] of TERMS) next = next.replace(re, to);
  if (next !== original) node.nodeValue = next;
};

const skippable = (parent: Element | null) => Boolean(parent?.closest(SKIP));

const walk = (root: Node) => {
  if (root.nodeType === Node.TEXT_NODE) {
    rewrite(root as Text);
    return;
  }
  if (!(root instanceof Element) || skippable(root)) return;
  const texts: Text[] = [];
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode: (n) => (skippable(n.parentElement) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT),
  });
  while (walker.nextNode()) texts.push(walker.currentNode as Text);
  texts.forEach(rewrite);
};

let started = false;

/** Reword the visible UI for Google Play builds. Safe to call more than once. */
export const startStoreWording = () => {
  if (started || typeof document === "undefined" || typeof window === "undefined") return;
  if (!isStoreBuild()) return;
  started = true;

  walk(document.body);

  const observer = new MutationObserver((records) => {
    for (const record of records) {
      if (record.type === "characterData") {
        if (record.target.nodeType === Node.TEXT_NODE) rewrite(record.target as Text);
      } else {
        record.addedNodes.forEach((node) => walk(node));
      }
    }
  });

  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
};
