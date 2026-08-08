// One-shot manual reassign test. Fetches a QUEUED directive and an
// AVAILABLE operative with the matching skill, then immediately fires
// the reassign — no copy/pasting ids by hand, no racing the clock.
// Usage: node scripts/test-reassign.js

const BASE_URL = process.env.NEXUS_URL ?? 'http://localhost:3000';

async function main() {
  const directivesRes = await fetch(`${BASE_URL}/directives?status=QUEUED`);
  const directives = await directivesRes.json();

  if (directives.length === 0) {
    console.log('No QUEUED directives right now — the router is keeping up. Try again in a few seconds.');
    return;
  }

  const operativesRes = await fetch(`${BASE_URL}/operatives`);
  let operatives = await operativesRes.json();

  const findMatch = (directive) =>
    operatives.find((op) => op.status === 'AVAILABLE' && op.skills.some((s) => s.id === directive.requiredSkillId));

  // Try each queued directive until we find one with a matching AVAILABLE operative.
  for (const directive of directives) {
    let match = findMatch(directive);

    // Nobody free with this skill right now — force one online instead of
    // giving up. Prefers an OFF_DUTY operative with the skill (doesn't
    // disturb anyone mid-mission).
    if (!match) {
      const candidate = operatives.find(
        (op) => op.status === 'OFF_DUTY' && op.skills.some((s) => s.id === directive.requiredSkillId),
      );
      if (!candidate) continue; // truly nobody on the roster has this skill

      console.log(`No one free for "${directive.title}" — bringing ${candidate.codename} online.`);
      const patchRes = await fetch(`${BASE_URL}/operatives/${candidate.id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'AVAILABLE' }),
      });
      if (!patchRes.ok) {
        console.log(`Could not bring ${candidate.codename} online (${patchRes.status}), trying next directive.`);
        continue;
      }
      match = { ...candidate, status: 'AVAILABLE' };
    }

    console.log(`Reassigning "${directive.title}" (${directive.priority}) -> ${match.codename}`);
    const res = await fetch(`${BASE_URL}/directives/${directive.id}/reassign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ operativeId: match.id }),
    });
    const body = await res.json();

    if (res.ok) {
      console.log('OK ->', body);
    } else {
      console.log(`Lost the race (${res.status}) ->`, body.message ?? body);
      console.log('That means RabbitMQ assigned it a split second earlier — this is expected, try running the script again.');
    }
    return;
  }

  console.log('There are QUEUED directives, but nobody who could take them is free or off-duty right now.');
  const anySkillMatch = directives.some((d) => operatives.some((op) => op.skills.some((s) => s.id === d.requiredSkillId)));
  if (anySkillMatch) {
    console.log('Everyone with the matching skill is currently BUSY/ASSIGNED on another directive — that\'s the system working as intended under load, not a bug. Try again shortly.');
  } else {
    console.log('None of the queued directives have a matching skill anywhere on the roster — that IS a data/seed issue, mention it and we\'ll adjust the seed.');
  }
}

main().catch((err) => {
  console.error('Script failed:', err.message);
});
