export const TEAM_UPS = [
  {
    id: 'gotham-knights',
    name: 'Gotham Knights',
    members: ['batman', 'nightwing'],
    cooldown: 18,
    effectKind: 'duoHaste',
    radius: 14,
    duration: 6000
  },
  {
    id: 'worlds-finest',
    name: "World's Finest",
    members: ['superman', 'wonder-woman'],
    cooldown: 20,
    effectKind: 'teamShield',
    radius: 14,
    duration: 4500
  },
  {
    id: 'emerald-velocity',
    name: 'Emerald Velocity',
    members: ['flash', 'green-lantern'],
    cooldown: 18,
    effectKind: 'duoHasteShield',
    radius: 15,
    duration: 5200
  },
  {
    id: 'titan-bond',
    name: 'Titan Bond',
    members: ['raven', 'starfire'],
    cooldown: 20,
    effectKind: 'teamHeal',
    radius: 15,
    healFactor: 0.28,
    shieldDuration: 2600
  },
  {
    id: 'network-override',
    name: 'Network Override',
    members: ['batman', 'cyborg'],
    cooldown: 22,
    effectKind: 'enemyDisrupt',
    radius: 14,
    duration: 2200
  }
];

export function availableTeamUps(heroId, teamHeroIds) {
  const ids = new Set(teamHeroIds);
  return TEAM_UPS.filter(teamUp =>
    teamUp.members.includes(heroId) &&
    teamUp.members.every(id => ids.has(id))
  );
}

export function preferredTeamUp(heroId, teamHeroIds) {
  return availableTeamUps(heroId, teamHeroIds)[0] || null;
}
