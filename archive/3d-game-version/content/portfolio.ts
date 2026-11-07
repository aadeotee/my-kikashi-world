/**
 * Everything the clearing shows lives here. Replace the placeholders with your own words,
 * links and images; `image` is optional and any URL or /public path works.
 */
export interface Item {
  title: string
  meta?: string
  body: string
  link?: string
  image?: string
  /** Fallback swatch when there is no image. */
  tint?: string
}

export const portfolio = {
  name: 'Your Name',
  tagline: 'One line about the kind of work you make.',
  about: {
    title: 'About Me',
    paragraphs: [
      'Placeholder. Write a short hello here: who you are, what you make, and what you care about.',
      'A second paragraph could cover where you are based, what you are working on, and what you would like to do next.',
    ],
    facts: [
      { label: 'Based in', value: 'Your city' },
      { label: 'Focus', value: 'Your discipline' },
      { label: 'Currently', value: 'What you are up to' },
    ],
  },
  works: [
    { title: 'Selected Work One', meta: 'Client · Year', body: 'Placeholder. One or two sentences on the brief and what you did.', tint: '#b4694a', link: '#' },
    { title: 'Selected Work Two', meta: 'Client · Year', body: 'Placeholder. One or two sentences on the brief and what you did.', tint: '#76905a', link: '#' },
    { title: 'Selected Work Three', meta: 'Client · Year', body: 'Placeholder. One or two sentences on the brief and what you did.', tint: '#d9b95f', link: '#' },
    { title: 'Selected Work Four', meta: 'Client · Year', body: 'Placeholder. One or two sentences on the brief and what you did.', tint: '#5f8f9c', link: '#' },
  ] as Item[],
  projects: [
    { title: 'Project One', meta: 'Role · Tools', body: 'Placeholder. What it is, why you built it, and how it turned out.', link: '#' },
    { title: 'Project Two', meta: 'Role · Tools', body: 'Placeholder. What it is, why you built it, and how it turned out.', link: '#' },
    { title: 'Project Three', meta: 'Role · Tools', body: 'Placeholder. What it is, why you built it, and how it turned out.', link: '#' },
  ] as Item[],
  experiments: [
    { title: 'Experiment One', meta: 'Sketch', body: 'Placeholder. A small idea you tried for the fun of it.', tint: '#9aa7c7', link: '#' },
    { title: 'Experiment Two', meta: 'Prototype', body: 'Placeholder. A small idea you tried for the fun of it.', tint: '#8e6d84', link: '#' },
    { title: 'Experiment Three', meta: 'Study', body: 'Placeholder. A small idea you tried for the fun of it.', tint: '#c98263', link: '#' },
    { title: 'Experiment Four', meta: 'Toy', body: 'Placeholder. A small idea you tried for the fun of it.', tint: '#9db184', link: '#' },
    { title: 'Experiment Five', meta: 'Zine', body: 'Placeholder. A small idea you tried for the fun of it.', tint: '#d29a8e', link: '#' },
  ] as Item[],
  explore: [
    { title: 'A link worth following', body: 'Placeholder for a playlist, reading list, or side quest.', link: '#' },
    { title: 'Something else to play with', body: 'Placeholder for another place visitors can wander off to.', link: '#' },
  ] as Item[],
  resume: {
    file: '',
    summary: 'Placeholder. A two-line summary of your experience.',
    experience: [
      { role: 'Your Role', place: 'Company', years: '2023 to now' },
      { role: 'Previous Role', place: 'Company', years: '2020 to 2023' },
    ],
    education: [{ role: 'Degree or Course', place: 'School', years: 'Year' }],
    skills: ['Skill one', 'Skill two', 'Skill three', 'Skill four'],
  },
  contact: {
    note: 'Placeholder. A warm line inviting people to get in touch.',
    links: [
      { label: 'Email', href: 'mailto:you@example.com', text: 'you@example.com' },
      { label: 'LinkedIn', href: '#', text: 'Your profile' },
      { label: 'Instagram', href: '#', text: '@yourhandle' },
    ],
  },
}
