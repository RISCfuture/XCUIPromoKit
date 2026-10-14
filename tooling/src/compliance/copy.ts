import { error, warning, type Finding } from './finding.ts';

type Rule = { rule: string; pattern: RegExp; severity: 'error' | 'warning'; message: string };

/**
 * What App Review rejects in the text of screenshots, previews and creative assets, or flags.
 * Errors are plainly against the guidelines; warnings need a person to judge.
 */
const rules: Rule[] = [
  {
    rule: 'price',
    pattern: /[$€£¥₹]\s?\d|\d\s?(USD|EUR|GBP|dollars?)\b|\b(price|sale|discount|\d+% off)\b/i,
    severity: 'error',
    message: 'mentions a price; prices vary by storefront and change',
  },
  {
    rule: 'URL',
    pattern: /\bhttps?:\/\/|\bwww\.|\b[a-z0-9-]+\.(com|net|org|io|app)\b/i,
    severity: 'error',
    message: 'contains a URL',
  },
  { rule: 'symbol', pattern: /[©®™℠]/, severity: 'error', message: 'contains a legal symbol' },
  {
    rule: 'platform',
    pattern: /\b(android|google play|play store|windows|samsung|galaxy|pixel|steam)\b/i,
    severity: 'error',
    message: 'names another platform or marketplace',
  },
  {
    rule: 'recognition',
    pattern: /\b(editor['’]?s'? choice|(app|game) of the (day|year)|apple design award)/i,
    severity: 'error',
    message: 'claims an Apple recognition, which the App Store shows itself',
  },
  {
    rule: 'reserved',
    pattern: /\bfor (kids|children)\b/i,
    severity: 'error',
    message: 'says “For Kids” or “For Children”, which are reserved for the Kids Category',
  },
  {
    rule: 'free',
    pattern: /\bfree\b/i,
    severity: 'warning',
    message: 'says “free”, which App Review scrutinizes',
  },
  {
    rule: 'claim',
    pattern: /#\s?1\b|\bnumber one\b|\bbest\b|\baward|\b(top|leading)\b/i,
    severity: 'warning',
    message: 'makes a claim App Review may ask you to substantiate',
  },
  {
    rule: 'dated',
    pattern:
      /\b(20\d\d|christmas|holiday|halloween|thanksgiving|black friday|new year|valentine|easter)\b/i,
    severity: 'warning',
    message: 'refers to a season or date, which dates the listing',
  },
];

/** Lints one piece of copy. `subject` names it in the report, such as `copy.en-US.json: climb`. */
export function lintCopy(subject: string, text: string): Finding[] {
  return rules
    .filter(({ pattern }) => pattern.test(text))
    .map(({ rule, severity, message }) =>
      (severity === 'error' ? error : warning)(subject, rule, message)
    );
}
