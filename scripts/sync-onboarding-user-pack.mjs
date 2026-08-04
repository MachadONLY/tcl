import { spawn } from "node:child_process";

const FORCE = process.argv.includes("--force");
const GROUPS = Object.freeze([
  ["group-arsenal", "ARS,AVL,BOU,BRE"],
  ["group-palace", "BHA,CHE,COV,CRY"],
  ["group-everton", "EVE,FUL,HUL,IPS"],
  ["group-manchester", "LEE,LIV,MCI,MUN"],
  ["group-newcastle", "NEW,NFO,SUN,TOT"]
]);

const wait = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));

function run(script, args = [], { tolerateFailure = false } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [script, ...args], {
      cwd: process.cwd(),
      env: process.env,
      stdio: "inherit"
    });

    child.on("error", error => {
      if (tolerateFailure) resolve(false);
      else reject(error);
    });
    child.on("exit", code => {
      if (code === 0) resolve(true);
      else if (tolerateFailure) resolve(false);
      else reject(new Error(`${script} exited with code ${code ?? 1}`));
    });
  });
}

for (const [shard, clubs] of GROUPS) {
  process.stdout.write(`\n=== ${shard}: ${clubs} ===\n`);
  const args = [`--clubs=${clubs}`, `--shard=${shard}`, ...(FORCE ? ["--force"] : [])];
  const generated = await run("scripts/run-onboarding-media-shard.mjs", args, { tolerateFailure: true });

  if (!generated) {
    process.stdout.write(`Primary resolver was incomplete for ${shard}; applying authoritative sources and preserving valid local assets.\n`);
  }

  let repaired = await run(
    "scripts/apply-onboarding-explicit-media.mjs",
    [`--clubs=${clubs}`, `--shard=${shard}`],
    { tolerateFailure: true }
  );

  if (!repaired) {
    process.stdout.write(`Retrying ${shard} after a short cooldown.\n`);
    await wait(12000);
    await run("scripts/run-onboarding-media-shard.mjs", [`--clubs=${clubs}`, `--shard=${shard}`], { tolerateFailure: true });
    repaired = await run(
      "scripts/apply-onboarding-explicit-media.mjs",
      [`--clubs=${clubs}`, `--shard=${shard}`],
      { tolerateFailure: false }
    );
  }
}

await run("scripts/merge-onboarding-media-shards.mjs");
await run("tests/onboarding-final-media-integrity.mjs");
process.stdout.write("\nOffline onboarding pack ready: all 20 clubs validated locally.\n");
