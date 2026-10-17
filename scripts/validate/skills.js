import fs from 'node:fs';
import path from 'node:path';
import { readTextOrFail, readSkillFolders } from './io.js';

export function frontMatterBlock(content, skill, fail) {
  const lines = content.split('\n');
  if (lines[0].trim() !== '---') {
    fail(`Skill '${skill}' missing opening front matter delimiter (---)`);
    return null;
  }
  const closingIdx = lines.slice(1).findIndex((l) => l.trim() === '---');
  if (closingIdx === -1) {
    fail(`Skill '${skill}' missing closing front matter delimiter (---)`);
    return null;
  }
  // Scope metadata lookups to the front-matter block only. Searching the
  // whole file let body prose or a fenced example satisfy the checks.
  const frontMatter = lines.slice(1, closingIdx + 1).join('\n');
  const nameMatch = frontMatter.match(/^name:\s*(.+)$/m);
  if (!nameMatch || nameMatch[1].trim() !== skill) {
    fail(`Skill '${skill}' front matter 'name:' does not match directory name`);
    return null;
  }
  return frontMatter;
}

export function extractSkillDescription(frontMatter) {
  const descMatch = frontMatter.match(/^description:\s*(.+)$/m);
  const desc = descMatch ? descMatch[1].trim() : '';
  if (!/^[>|][-+]?$/.test(desc)) return desc;
  // YAML block scalars (>- / |) put the real text on following indented
  // lines. Reading only the `>-` marker measured a 2-char "description" and
  // defeated the 1024-char context-budget cap, so fold them in.
  const afterDesc = frontMatter.slice(frontMatter.indexOf(descMatch[0]) + descMatch[0].length);
  const folded = afterDesc.split('\n')
    .filter((l) => /^\s+\S/.test(l))
    .map((l) => l.trim())
    .join(' ');
  return folded.trim();
}

function checkSkillDescription(desc, skill, ctx) {
  if (!desc) {
    ctx.fail(`Skill '${skill}' missing front matter 'description:'`);
    return;
  }
  if (!/^Use when/i.test(desc)) ctx.warn(`Skill '${skill}' description should start with imperative 'Use when...'`);
  if (!/do not use/i.test(desc)) ctx.warn(`Skill '${skill}' description should specify negative boundaries ('Do not use for...')`);
  if (desc.length > 1024) ctx.fail(`Skill '${skill}' description exceeds 1024 chars (${desc.length} chars)`);
}

function checkSkillBody(checked, ctx) {
  const lines = checked.content.split('\n');
  if (lines.length > 500) ctx.warn(`Skill '${checked.skill}' exceeds 500 lines (${lines.length} lines). Offload details to references/.`);
  else ctx.pass(`Skill '${checked.skill}': ${lines.length} lines, description valid (${checked.desc.length} chars).`);
  if (!/What NOT to do/i.test(checked.content) && !/Gotchas/i.test(checked.content)) {
    ctx.warn(`Skill '${checked.skill}' missing mandatory 'Gotchas & What NOT to Do' section`);
  }
}

export function checkOneSkill(skill, skillsDir, ctx) {
  const skillFile = path.join(skillsDir, skill, 'SKILL.md');
  if (!fs.existsSync(skillFile)) {
    ctx.fail(`Skill '${skill}' missing SKILL.md`);
    return;
  }
  const content = readTextOrFail(skillFile, `Skill '${skill}'`, ctx.fail);
  if (content === null) return;
  const frontMatter = frontMatterBlock(content, skill, ctx.fail);
  if (frontMatter === null) return;
  const desc = extractSkillDescription(frontMatter);
  checkSkillDescription(desc, skill, ctx);
  checkSkillBody({ content, desc, skill }, ctx);
}

export function phaseSkills(ctx) {
  ctx.log('');
  ctx.heading('3. Checking Specialized Skills (.agents/skills)...');
  const skillsDir = path.join(ctx.workspaceRoot, '.agents', 'skills');
  if (!fs.existsSync(skillsDir)) {
    ctx.fail(`Missing .agents/skills directory at ${skillsDir}`);
    return 0;
  }
  const folders = readSkillFolders(skillsDir, ctx.fail);
  let count = 0;
  for (const skill of folders) {
    count += 1;
    checkOneSkill(skill, skillsDir, ctx);
  }
  ctx.pass(`Validated ${count} skills in .agents/skills/.`);
  return count;
}

export default { phaseSkills, checkOneSkill, extractSkillDescription, frontMatterBlock };
