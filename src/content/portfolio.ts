/**
 * Everything the clearing shows lives here. Swap in your own words, links and images; `image` is optional and any URL or /public path works.
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
  name: 'Aditi Ghosh',
  /** The words that fade in and out in the middle of the page. */
  welcome: { title: 'Welcome to Aditi’s world', subtitle: 'aka Poulita' },
  mazePrompt: 'Solve the maze',
  /** The name of each place, shown on its sign in the world and at the top of its panel. */
  sections: {
    about: { title: 'The Whomping Willow', kicker: 'Mind the branches' },
    works: { title: 'Gringotts', kicker: 'Down in the vaults' },
    projects: { title: 'Diagon Alley', kicker: 'Open for business' },
    experiments: { title: 'Snape’s Dungeon', kicker: 'Do not touch the cauldrons' },
    play: { title: 'Quidditch Pitch', kicker: 'Brooms at the ready' },
    resume: { title: 'Hermione’s Homework', kicker: 'Handed in early' },
    contact: { title: 'The Owlery', kicker: 'Send an owl' },
  },
  about: {
    paragraphs: [
      'You made it through the maze. This is Aditi’s little corner of the internet, built just for fun.',
      'Have a wander. Every sign out there leads somewhere.',
    ],
    facts: [
      { label: 'Address', value: 'Just past the hedge maze' },
      { label: 'Also known as', value: 'Poulita' },
      { label: 'Wand', value: 'Still being chosen' },
    ],
  },
  works: [
    { title: 'Vault One', meta: 'Locked', body: 'The goblins are still counting what goes in here.', tint: '#b4694a' },
    { title: 'Vault Two', meta: 'Locked', body: 'Nobody has found the key yet.', tint: '#76905a' },
    { title: 'Vault Three', meta: 'Locked', body: 'Something is rattling inside.', tint: '#d9b95f' },
    { title: 'Vault Four', meta: 'Locked', body: 'Guarded by a very sleepy dragon.', tint: '#5f8f9c' },
  ] as Item[],
  projects: [
    { title: 'This little world', meta: 'React · three.js', body: 'The cottage, the hedge maze and the golden tree you just walked through.' },
    { title: 'Shop to let', meta: 'Coming soon', body: 'The shutters are down, but there is hammering behind them.' },
  ] as Item[],
  experiments: [
    { title: 'Cauldron One', meta: 'Simmering', body: 'Smells a bit like burnt toast.', tint: '#9aa7c7' },
    { title: 'Cauldron Two', meta: 'Bubbling', body: 'It has started humming.', tint: '#8e6d84' },
    { title: 'Cauldron Three', meta: 'Fizzing', body: 'Best kept at arm’s length.', tint: '#c98263' },
    { title: 'Cauldron Four', meta: 'Empty', body: 'Nobody will say what happened to this one.', tint: '#9db184' },
  ] as Item[],
  explore: [
    { title: 'Catch the snitch', body: 'It was last seen somewhere in the hedges.' },
    { title: 'Turn the sound on', body: 'Press the speaker in the corner and listen to the garden.' },
  ] as Item[],
  resume: {
    file: '',
    summary: 'Twelve rolls of parchment on walking through hedges, with footnotes.',
    experience: [
      { role: 'Keeper of this little world', place: 'Right here', years: 'Now' },
      { role: 'Maze architect', place: 'The back garden', years: 'Also now' },
    ],
    education: [{ role: 'Letter still in the post', place: 'Hogwarts', years: 'Any day now' }],
    skills: ['Hedge navigation', 'Bench sitting', 'Cottage keeping', 'Golden tree care'],
  },
  contact: {
    note: 'The owls are still in training. Check back soon.',
    links: [] as { label: string; href: string; text: string }[],
  },
}
