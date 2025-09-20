// OpenResume-compatible lightweight parser (temporary)
// Replace with the official OpenResume parser when available.

function safe(s) { return (s || '').toString().trim(); }
function linesOf(text) { return (text || '').split(/\r?\n/).map(l => l.trim()); }
function uniq(arr){ return Array.from(new Set(arr.filter(Boolean))); }

function extractBasics(text) {
  const email = (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [])[0] || '';
  const phone = (text.match(/(\+?\d[\d\s().-]{7,}\d)/) || [])[0] || '';
  const linkedin = (text.match(/https?:\/\/[\w.-]*linkedin\.com\/[\w\-_/]+/i) || [])[0] || '';
  const github = (text.match(/https?:\/\/[\w.-]*github\.com\/[\w\-_/]+/i) || [])[0] || '';
  // name: first non-empty line without email/phone/url
  const name = (linesOf(text).find(l => l && !/@/.test(l) && !/https?:\/\//i.test(l) && !/(phone|mobile)/i.test(l) && l.split(/\s+/).length <= 6) || '')
    .replace(/[,;]$/, '');
  return {
    name: safe(name),
    email: safe(email),
    phone: safe(phone),
    address: { city: '', region: '', country: '', postalCode: '' },
    profiles: { linkedin: safe(linkedin), github: safe(github) },
    summary: ''
  };
}

function extractSkills(text) {
  const lower = text.toLowerCase();
  const tech = [
    'javascript','typescript','react','next.js','next','node','express','redux','tailwind','bootstrap','mui',
    'html','css','sass','less','webpack','vite','babel','jest','cypress','playwright','storybook',
    'graphql','apollo','rest','mongo','mongodb','mongoose','mysql','postgres','redis','docker','kubernetes',
    'aws','s3','ec2','lambda','cloudfront','azure','gcp','firebase','git','github','bitbucket','gitlab','ci','cd','devops'
  ];
  const found = uniq(tech.filter(k => lower.includes(k)));
  return found.length ? [{ name: 'Technical', keywords: found }] : [];
}

function parseDate(s) {
  if (!s) return null;
  const m1 = s.match(/(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[\s.-]*([0-9]{4})/i);
  if (m1) return new Date(`${m1[1]} 1, ${m1[2]}`);
  const m2 = s.match(/([0-9]{1,2})[\/\-]([0-9]{4})/);
  if (m2) return new Date(`${m2[1]}/1/${m2[2]}`);
  const m3 = s.match(/\b(20\d{2}|19\d{2})\b/);
  if (m3) return new Date(`1/1/${m3[1]}`);
  return null;
}

function extractWork(text) {
  const ls = linesOf(text);
  const out = [];
  const DATE_RANGE = /([A-Za-z]{3,9}\.?\s*\d{4}|\d{2}[\/\-]\d{4}|\d{4})\s*[–-]\s*(Present|Current|[A-Za-z]{3,9}\.?\s*\d{4}|\d{2}[\/\-]\d{4}|\d{4})/i;
  for (let i = 0; i < ls.length; i++) {
    const l = ls[i];
    const m = l.match(DATE_RANGE);
    if (m) {
      const prev1 = ls[i-1] || '';
      const prev2 = ls[i-2] || '';
      const context = `${prev2} ${prev1}`.trim();
      const pos = (context.match(/(Engineer|Developer|Manager|Lead|Intern|Architect|Consultant|Analyst|Designer)/i) || [])[0] || '';
      const comp = (context.match(/([A-Z][A-Za-z0-9 .,&-]{2,})/) || [])[1] || '';
      out.push({
        company: safe(comp),
        position: safe(pos),
        location: '',
        startDate: parseDate(m[1]) || null,
        endDate: /present|current/i.test(m[2]) ? null : (parseDate(m[2]) || null),
        summary: ''
      });
    }
  }
  return out;
}

function extractEducation(text) {
  const ls = linesOf(text);
  const out = [];
  const DEGREE = /(B\.?\s*Tech|B\.?\s*E\.?|BSc|MSc|MCA|MBA|Bachelor|Master|Diploma|BE|B\.Tech|M\.Tech)/i;
  for (let i = 0; i < ls.length; i++) {
    const l = ls[i];
    if (DEGREE.test(l)) {
      const inst = ls[i+1] && /[A-Za-z]/.test(ls[i+1]) ? ls[i+1] : '';
      const date = (l.match(/(\b\w{3,9}\.?\s*\d{4}\b|\b\d{4}\b)/) || [])[0] || '';
      out.push({
        institution: safe(inst),
        degree: safe((l.match(DEGREE) || ['',''])[0]),
        studyType: '',
        field: '',
        startDate: null,
        endDate: parseDate(date)
      });
    }
  }
  return out;
}

function extractProjects(text) {
  const projects = [];
  // minimal placeholder; real OpenResume parser will do better
  return projects;
}

function extractCerts(text) {
  const certs = [];
  return certs;
}

async function parse(text) {
  const basics = extractBasics(text);
  const work = extractWork(text);
  const education = extractEducation(text);
  const skills = extractSkills(text);
  const projects = extractProjects(text);
  const certifications = extractCerts(text);
  return {
    personal: basics,
    work,
    education,
    skills,
    projects,
    certifications
  };
}

module.exports = { parse };
