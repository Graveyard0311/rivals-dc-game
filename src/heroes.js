export const HEROES = [
  { id:'superman', name:'Superman', universe:'DC', role:'Vanguard', hp:700, speed:7.4, damage:38, fireRate:0.34, range:22, color:0x2878ff, ability:'Solar Rush', ultimate:'Worldbreaker' },
  { id:'wonder-woman', name:'Wonder Woman', universe:'DC', role:'Vanguard', hp:650, speed:7.2, damage:42, fireRate:0.42, range:7, color:0xd94b52, ability:'Aegis Charge', ultimate:'Amazon Fury' },
  { id:'batman', name:'Batman', universe:'DC', role:'Duelist', hp:360, speed:8.2, damage:31, fireRate:0.20, range:19, color:0x424a62, ability:'Grapnel Burst', ultimate:'Fear Protocol' },
  { id:'flash', name:'The Flash', universe:'DC', role:'Duelist', hp:325, speed:10.5, damage:26, fireRate:0.14, range:6, color:0xe03838, ability:'Speed Force Dash', ultimate:'Infinite Mass' },
  { id:'green-lantern', name:'Green Lantern', universe:'DC', role:'Strategist', hp:400, speed:7.5, damage:29, fireRate:0.25, range:24, color:0x35e783, ability:'Construct Shield', ultimate:'Emerald Army' },
  { id:'raven', name:'Raven', universe:'DC', role:'Strategist', hp:360, speed:7.1, damage:30, fireRate:0.28, range:22, color:0x8a66d9, ability:'Soul Bind', ultimate:'Azarath' },

  { id:'thanos', name:'Thanos', universe:'Marvel', role:'Vanguard', hp:780, speed:6.7, damage:46, fireRate:0.45, range:9, color:0x7251a8, ability:'Titan Charge', ultimate:'Infinity Surge' },
  { id:'juggernaut', name:'Juggernaut', universe:'Marvel', role:'Vanguard', hp:760, speed:6.9, damage:44, fireRate:0.40, range:6, color:0x9b3b32, ability:'Unstoppable', ultimate:'Crimson Impact' },
  { id:'doctor-doom', name:'Doctor Doom', universe:'Marvel', role:'Duelist', hp:430, speed:7.0, damage:36, fireRate:0.24, range:25, color:0x4c8d68, ability:'Arcane Barrage', ultimate:'Doom Protocol' },
  { id:'gorr', name:'Gorr the God Butcher', universe:'Marvel', role:'Duelist', hp:420, speed:7.8, damage:40, fireRate:0.26, range:11, color:0xdadada, ability:'Necrosword Lunge', ultimate:'Black Berserker' },
  { id:'silver-surfer', name:'Silver Surfer', universe:'Marvel', role:'Strategist', hp:390, speed:8.6, damage:30, fireRate:0.22, range:27, color:0xc9d2dc, ability:'Cosmic Renewal', ultimate:'Power Cosmic' },
  { id:'professor-x', name:'Professor X', universe:'Marvel', role:'Strategist', hp:330, speed:6.1, damage:25, fireRate:0.32, range:26, color:0x5576c7, ability:'Psychic Barrier', ultimate:'Cerebral Lock' },
  { id:'kang', name:'Kang', universe:'Marvel', role:'Duelist', hp:390, speed:7.2, damage:34, fireRate:0.24, range:24, color:0x5d55ae, ability:'Temporal Shift', ultimate:'Chrono Collapse' }
];

export const getHero = id => HEROES.find(h => h.id === id) || HEROES[0];
