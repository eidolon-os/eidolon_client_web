import { describe, expect, it } from "vitest";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

import ledger from "../wire_contract_mirror.json";

/**
 * This client's wire vocabulary, held to the SDK's, with nothing left undecided.
 *
 * `eidolon_sdk/biz/contracts` is the vocabulary every Body speaks. It is Python,
 * it is not vendored, and it is never transmitted — so nothing about it reaches
 * this repository except somebody copying a value into `src/lib/contracts.ts`.
 * That file was written on 2026-06-25 and until 2026-09-07 nothing compared it
 * to anything. It was found by a roster scan in the SDK, not by this repository
 * noticing.
 *
 * ## Why the unit is the vocabulary, not the constant
 *
 * A roll-call of assertions cannot catch the constant that was just added. On
 * 2026-08-26 `SESSION_CONVERSATION_ID_FIELD` entered the contract and became
 * required. The firmware's mirror asserted it and went red the same day; the
 * mobile mirror listed a hand-picked six that did not include it and stayed
 * green, and for twelve days the phone published a session request without the
 * member that makes it a request. `normalize_conversation_id(null)` is null, and
 * a null there is dropped without a log line on either side.
 *
 * So the boundary here is the whole contract file. **Every module-level constant
 * it publishes** must carry a decision in `wire_contract_mirror.json` — mirrored
 * to a named constant in `src/lib/contracts.ts`, or deliberately not mirrored
 * with a reason. A new constant lands in neither column and this fails, naming
 * it. Nobody has to remember to add an assertion.
 *
 * The scope used to be a prefix list in the mobile ledger, which was the same
 * mistake one level out — a roll-call of vocabularies rather than of constants,
 * and just as able to go short by choosing less. It did, by twenty constants.
 *
 * ## Why it lives here
 *
 * The SDK's `test_client_contract_mirrors.py` skips a client whose checkout is
 * absent, so a mirror that only lives there verifies nothing in a checkout that
 * does not have it — and this client was not even listed until a scan went
 * looking. A check in the repository that must act on the result cannot skip on
 * its own files. It still skips when the SDK is not beside it, because there is
 * then genuinely nothing to compare against, and it says so by name rather than
 * passing quietly.
 */

// vitest runs from the package root. Confirmed rather than assumed: resolving
// the repository wrongly would make every `existsSync` below false, and this
// check would then skip its way to green while verifying nothing.
const REPO_ROOT = process.cwd();
const CONTRACTS_TS = resolve(REPO_ROOT, "src/lib/contracts.ts");
const PUBLISHER_TS = resolve(REPO_ROOT, "src/hooks/useClientAudioStatePublisher.ts");
const SDK_CONTRACTS = resolve(
  process.env.EIDOLON_SDK_REPO ?? resolve(REPO_ROOT, "../eidolon_sdk"),
  "eidolon_sdk/biz/contracts/__init__.py",
);

interface Decision {
  ts?: string;
  not_mirrored?: string;
  declared_only?: boolean;
  note?: string;
}

const decisions = ledger.constants as Record<string, Decision>;

/**
 * Stands in for a constant whose value is computed rather than literal.
 *
 * Such a name still entered the vocabulary and still needs a decision, so it is
 * inventoried; only the value comparison is impossible. A ledger entry claiming
 * to mirror one fails rather than passing unchecked.
 */
const COMPUTED = Symbol("computed in the SDK");
type Value = string | number | typeof COMPUTED;

/**
 * Module-level upper-case assignments, read as text rather than executed.
 *
 * Anchored at column 0 because Python indents every nested scope, so this cannot
 * pick up a constant defined inside a function or class. Deliberately narrow
 * about values and **fail-closed**: a literal written any other way (single
 * quotes, a wrapped line, an f-string) is inventoried as COMPUTED, so a ledger
 * entry pointing at it reports that it cannot be checked instead of silently
 * agreeing with nothing.
 */
function sdkConstants(source: string): Map<string, Value> {
  const found = new Map<string, Value>();
  const assignment = /^([A-Z][A-Z0-9_]*)\s*(?::[^=\n]+)?=[ \t]*(.*)$/gm;
  for (const [, name, rhs] of source.matchAll(assignment)) {
    const literal = rhs.trim().replace(/\s*#.*$/, "");
    const asString = /^"([^"\\]*)"$/.exec(literal);
    const asInt = /^(\d+)$/.exec(literal);
    found.set(
      name,
      asString ? asString[1] : asInt ? Number(asInt[1]) : COMPUTED,
    );
  }
  return found;
}

/** `export const NAME = "value";` / `= 123;`, with or without a type annotation. */
function tsConstants(source: string): Map<string, string | number> {
  const found = new Map<string, string | number>();
  const declaration =
    /^export const ([A-Za-z_]\w*)\s*(?::[^=]+)?=\s*(?:"([^"\\]*)"|(\d+))\s*;/gm;
  for (const [, name, text, digits] of source.matchAll(declaration)) {
    found.set(name, text !== undefined ? text : Number(digits));
  }
  return found;
}

/** Members of a Python `frozenset({...})` of plain string literals. */
function pythonStringSet(source: string, name: string): string[] {
  const block = new RegExp(`^${name}\\s*=\\s*frozenset\\(([\\s\\S]*?)\\n\\)`, "m").exec(source);
  expect(block, `${name} is not a frozenset literal in the SDK any more`).not.toBeNull();
  return [...block![1].matchAll(/"([^"\\]*)"/g)].map((m) => m[1]);
}

const contractsSource = existsSync(CONTRACTS_TS)
  ? readFileSync(CONTRACTS_TS, "utf-8")
  : null;
const sdkPresent = existsSync(SDK_CONTRACTS);

describe("the ledger decides, rather than listing what is convenient", () => {
  // These hold without the SDK beside us: the ledger's own shape is the thing
  // that can be made to pass by choosing less, so it is asserted on its own.

  it("resolved this repository, so an absent SDK is news rather than the default", () => {
    // If REPO_ROOT were wrong, every existsSync below would be false and the
    // whole SDK half would skip its way to green. Cheap to rule out.
    const manifest = resolve(REPO_ROOT, "package.json");
    expect(existsSync(manifest), `${REPO_ROOT} is not the package root`).toBe(true);
    expect(JSON.parse(readFileSync(manifest, "utf-8")).name).toBe("eidolon-client-web");
  });

  it("declares src/lib/contracts.ts, the file every decision is named against", () => {
    // Fails, and says what happened. `readFileSync` would already throw, but a
    // traceback is not a diagnosis, and this is the one file whose disappearance
    // makes every assertion below meaningless. The SDK's own mirror had the
    // sibling of this bug and it *skipped*: a rename turned the whole check into
    // a silent pass, forever.
    expect(
      contractsSource,
      "src/lib/contracts.ts is gone — every mirrored constant is named against " +
        "it, so nothing here could be checked. If it moved, move this path with it.",
    ).not.toBeNull();
  });

  it("gives every entry exactly one decision, and every excuse a reason", () => {
    expect(Object.keys(decisions).length).toBeGreaterThan(0);
    for (const [name, decision] of Object.entries(decisions)) {
      const mirrored = typeof decision.ts === "string" && decision.ts.length > 0;
      const excused =
        typeof decision.not_mirrored === "string" && decision.not_mirrored.trim().length > 0;
      expect(
        mirrored !== excused,
        `${name} must be mirrored or explained, not both and not neither`,
      ).toBe(true);
      if (excused) {
        // A reason somebody can argue with, not a placeholder.
        expect(
          decision.not_mirrored!.trim().length,
          `${name} needs a reason, not a placeholder`,
        ).toBeGreaterThan(20);
      }
      expect(
        !(decision.declared_only && excused),
        `${name} is not mirrored, so it cannot also be a declared-only mirror`,
      ).toBe(true);
    }
  });

  it("does not let src/lib/contracts.ts declare a wire name nobody decided", () => {
    // The other direction. A constant invented here that the contract does not
    // publish is a value no Host sends and no mirror can see — the failure the
    // Companion lifecycle mirror found when a client had made up three states.
    const declared = tsConstants(contractsSource!);
    const mirrored = new Set(
      Object.values(decisions)
        .map((d) => d.ts)
        .filter((name): name is string => Boolean(name)),
    );
    const undecided = [...declared.keys()].filter((name) => !mirrored.has(name)).sort();
    expect(
      undecided,
      `${undecided.join(", ")} are declared in contracts.ts and no ledger entry claims them — ` +
        "a wire name this client invented is one nothing can check",
    ).toEqual([]);
  });

  it("keeps declared_only honest in both directions", () => {
    // Nineteen of the twenty-four mirrored constants are declarations nothing
    // imports. That is worth recording rather than hiding, and worth verifying:
    // the moment somebody starts consuming one, this fails and makes them look
    // at the ledger entry — which is exactly when its value stops being inert.
    const consumers = ["src/hooks", "src/components", "src/avatar", "src/pages", "src/lib"]
      .flatMap((dir) => sourceFilesUnder(resolve(REPO_ROOT, dir)))
      .filter((path) => path !== CONTRACTS_TS)
      .map((path) => readFileSync(path, "utf-8"))
      .join("\n");

    for (const [name, decision] of Object.entries(decisions)) {
      if (!decision.ts) continue;
      const used = new RegExp(`\\b${decision.ts}\\b`).test(consumers);
      if (decision.declared_only) {
        expect(
          used,
          `${name} is recorded as declared_only but ${decision.ts} is now used in src/ — ` +
            "drop the flag, and check that the value it carries is the one you want",
        ).toBe(false);
      } else {
        expect(
          used,
          `${decision.ts} is no longer used in src/ — mark ${name} declared_only rather than ` +
            "leaving the ledger claiming a live surface this client no longer has",
        ).toBe(true);
      }
    }
  });
});

describe.skipIf(!sdkPresent)("the wire vocabulary agrees with the SDK", () => {
  const sdkSource = sdkPresent ? readFileSync(SDK_CONTRACTS, "utf-8") : "";
  const sdk = sdkConstants(sdkSource);

  it("read the contract at all", () => {
    // A parser that silently read nothing would make every comparison below
    // vacuous while the failures it produced pointed the wrong way.
    expect(sdk.size).toBeGreaterThan(40);
    expect(sdk.get("SESSION_CONTROL_TOPIC")).toBe("eidolon.session_control");
    expect(sdk.get("WIRE_SCHEMA_VERSION")).toBe(1);
  });

  it("has a decision for every constant the contract publishes", () => {
    // The assertion that would have caught the twelve-day bug: a constant
    // entered the contract and nobody decided anything about it.
    const undecided = [...sdk.keys()].filter((name) => !(name in decisions)).sort();
    expect(
      undecided,
      `${undecided.join(", ")} are new in the wire contract and the ledger says nothing about ` +
        "them — mirror each one, or record why this client does not carry it",
    ).toEqual([]);
  });

  it("has no decision about a constant the contract no longer publishes", () => {
    const orphaned = Object.keys(decisions).filter((name) => !sdk.has(name)).sort();
    expect(
      orphaned,
      `${orphaned.join(", ")} are in the ledger and no longer in the SDK: a decision that ` +
        "outlives the thing it was about",
    ).toEqual([]);
  });

  it("matches every mirrored value against the constant that carries it", () => {
    const declared = tsConstants(contractsSource!);
    const wrong: string[] = [];
    for (const [name, decision] of Object.entries(decisions)) {
      if (!decision.ts || !sdk.has(name)) continue;
      const expected = sdk.get(name)!;
      if (expected === COMPUTED) {
        wrong.push(`${name} is computed in the SDK, so ${decision.ts} cannot be checked against it`);
      } else if (!declared.has(decision.ts)) {
        // Named before it is compared. A thrown lookup is closed, which is the
        // property that matters, but it is a crash where a sentence would do.
        wrong.push(
          `${name} claims to be mirrored by ${decision.ts}, which contracts.ts does not declare`,
        );
      } else if (declared.get(decision.ts) !== expected) {
        wrong.push(
          `${decision.ts} is ${JSON.stringify(declared.get(decision.ts))} and ` +
            `${name} is ${JSON.stringify(expected)}`,
        );
      }
    }
    expect(wrong, wrong.join("; ")).toEqual([]);
  });

  it("refuses a decision that has rotted into a lie", () => {
    // Recorded as not mirrored while the value is in fact written somewhere in
    // src/ anyway. Only distinctive values are searched: SESSION_END_ERROR is
    // "error", and a check that cried wolf on that would be switched off within
    // a day. A wire value that is a bare English word cannot be told from
    // ordinary code by looking, so this does not pretend to — the ledger says
    // which entries are reasoning rather than measurement.
    const src = sourceFilesUnder(resolve(REPO_ROOT, "src"))
      .filter((path) => path !== CONTRACTS_TS)
      .map((path) => readFileSync(path, "utf-8"))
      .join("\n");

    const leaked: string[] = [];
    for (const [name, decision] of Object.entries(decisions)) {
      if (!decision.not_mirrored) continue;
      const value = sdk.get(name);
      if (typeof value !== "string") continue;
      const distinctive = value.length >= 8 || value.includes(".") || value.includes("_");
      if (!distinctive) continue;
      if (src.includes(`"${value}"`) || src.includes(`'${value}'`)) {
        leaked.push(
          `${name} is recorded as not mirrored (${decision.not_mirrored}) but its value ` +
            `${JSON.stringify(value)} is written in src/ anyway`,
        );
      }
    }
    expect(leaked, leaked.join("; ")).toEqual([]);
  });

  it("keeps every published audio-state key inside the set the server accepts", () => {
    // The other half of CLIENT_AUDIO_STATE_KNOWN_KEYS, which is a computed set
    // and so cannot be mirrored as a constant. The coupling is real and silent
    // in exactly the documented way: the parser filters against this set, so a
    // key outside it — the `ppt`/`ptt` typo the contract's own comment names —
    // is discarded rather than refused.
    const known = new Set(pythonStringSet(sdkSource, "CLIENT_AUDIO_STATE_KNOWN_KEYS"));
    const publisher = readFileSync(PUBLISHER_TS, "utf-8");
    const payload = /const payload = \{([\s\S]*?)\n {6}\};/.exec(publisher);
    expect(payload, "the client.audio_state payload literal moved; move this check with it")
      .not.toBeNull();

    const keys = [...payload![1].matchAll(/^ {8}(\w+):/gm)].map((m) => m[1]);
    expect(keys.length, "the payload read as empty, which is never agreement").toBeGreaterThan(4);
    const unknown = keys.filter((key) => !known.has(key)).sort();
    expect(
      unknown,
      `the publisher sends ${unknown.join(", ")}, which CLIENT_AUDIO_STATE_KNOWN_KEYS does not ` +
        "accept — the server drops such a key rather than refusing the packet",
    ).toEqual([]);
  });
});

/** Every .ts/.tsx file under a directory, so a new one cannot escape the scans. */
function sourceFilesUnder(root: string): string[] {
  if (!existsSync(root)) return [];
  const out: string[] = [];
  for (const entry of readdirSync(root, { withFileTypes: true })) {
    const path = resolve(root, entry.name);
    if (entry.isDirectory()) out.push(...sourceFilesUnder(path));
    else if (/\.tsx?$/.test(entry.name)) out.push(path);
  }
  return out;
}
