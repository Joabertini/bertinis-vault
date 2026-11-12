/**
 * The play notes, lifted from the D&D cheat sheet.
 *
 * Generated from Joabertini/dnd-cheatsheet — every line of prose here was
 * written by hand for that project and copied across unchanged. It is the one
 * thing the 5etools index does not carry: the index knows a Fighter has
 * Second Wind, and knows nothing about players forgetting to use it between
 * waves.
 *
 * Twelve classes, 101 subclasses, 22 feats and 14 combinations.
 *
 * Two things were dropped on the way in. The per-class palette, because the
 * Vault already tints by class through `tintFor` and two colour systems on
 * one page fight each other. And each combination’s `check` predicate,
 * which cannot survive serialisation — those are rewritten as real
 * functions in `playbook.ts`, against this file’s ids.
 *
 * The optional fields below are marked from counting every record rather than
 * from reading one: `resource` is on 69 of 187 play notes, `tip` on 21 of
 * 22 feats, `forgottenTip` on 9 of 101 subclasses. Typing those as
 * required would reject the file it came from.
 *
 * Edit the cheat sheet, not this file: it is generated.
 */

export type PlayNote = {
  name: string;
  desc: string;
  /** A limited pool: "1/descanso corto", "Dados de Superioridad (d8→d12)". */
  resource?: string;
  /** The ones worth reading first. */
  highlight?: boolean;
};

export type SubclassNotes = {
  extra: PlayNote[];
  forgottenTip?: string;
};

export type ClassNotes = {
  icon: string;
  role: string;
  difficultyWarnings: string[];
  bonusActions: PlayNote[];
  reactions: PlayNote[];
  classFeatures: PlayNote[];
  forgottenTip: string;
  subclasses: Record<string, SubclassNotes>;
};

export type FeatNote = {
  icon: string;
  category: "passive" | "active" | "bonus_action" | "reaction";
  desc: string;
  /** What it costs to use, where it costs anything. */
  resource?: string;
  /** How it is actually played. The half the rules text never says. */
  tip?: string;
  highlight?: boolean;
};

export type ComboNote = {
  id: string;
  name: string;
  icon: string;
  tags: string[];
  /** What it is. */
  what: string;
  /** How it is actually played at the table. */
  how: string;
  highlight: boolean;
};

export type RuleBlock = {
  title: string;
  items: Array<{ label: string; desc: string; color?: string }>;
};

export const CLASS_NOTES: Record<string, ClassNotes> = {
  "fighter": {
    "icon": "⚔️",
    "role": "Guerrero marcial",
    "difficultyWarnings": [],
    "bonusActions": [
      {
        "name": "Segunda acción de ataque",
        "desc": "Con Action Surge podés tomar OTRA acción completa (1 vez por descanso corto)",
        "highlight": true
      },
      {
        "name": "Ataque con arma secundaria",
        "desc": "Si peleás con dos armas ligeras, usá la acción adicional para atacar con la mano secundaria (sin agregar modificador al daño)"
      }
    ],
    "reactions": [
      {
        "name": "Ataque de oportunidad",
        "desc": "Cuando un enemigo sale de tu alcance sin Desengancharse, podés atacar con tu reacción"
      }
    ],
    "classFeatures": [
      {
        "name": "Second Wind",
        "resource": "1/descanso corto",
        "desc": "Acción adicional: recuperás 1d10 + nivel de Fighter de HP. ¡No lo olvides entre combates!"
      },
      {
        "name": "Action Surge",
        "resource": "1/descanso corto (2 en nivel 17)",
        "desc": "Tomás una acción adicional completa en tu turno. La herramienta más poderosa del Fighter.",
        "highlight": true
      }
    ],
    "forgottenTip": "⚠️ El error más común del Fighter: olvidar usar Second Wind entre oleadas de combate.",
    "subclasses": {
      "Champion": {
        "extra": [
          {
            "name": "Golpe Crítico mejorado",
            "desc": "Crítico con 19-20 (nivel 3), 18-20 (nivel 15)."
          }
        ]
      },
      "Battle Master": {
        "extra": [
          {
            "name": "Maniobras",
            "resource": "Dados de Superioridad (d8→d12)",
            "desc": "Dados limitados. Cada maniobra los gasta. Se recuperan en descanso corto.",
            "highlight": true
          }
        ],
        "forgottenTip": "⚠️ Battle Master: podés usar VARIAS maniobras distintas por turno mientras tengas dados."
      },
      "Eldritch Knight": {
        "extra": [
          {
            "name": "Spellcasting",
            "desc": "Spell slots limitados.",
            "highlight": true
          },
          {
            "name": "War Magic (nivel 7)",
            "desc": "Cuando lanzás un cantrip, podés hacer un ataque con arma como acción adicional."
          }
        ]
      },
      "Purple Dragon Knight": {
        "extra": [
          {
            "name": "Rallying Cry (nivel 3)",
            "desc": "Con Second Wind: hasta 3 aliados recuperan HP igual a tu nivel de Fighter.",
            "highlight": true
          }
        ]
      },
      "Arcane Archer": {
        "extra": [
          {
            "name": "Arcane Shot",
            "resource": "2 usos / descanso corto",
            "desc": "Flechas mágicas: Banishing, Bursting, Enfeebling, Grasping, Piercing, Seeking, Shadow, Beguiling.",
            "highlight": true
          }
        ],
        "forgottenTip": "⚠️ Arcane Shot se recupera en descanso CORTO. Usalo en cada combate."
      },
      "Cavalier": {
        "extra": [
          {
            "name": "Unwavering Mark (nivel 3)",
            "desc": "Al atacar: marcás al objetivo. Si ataca a otro aliado, podés atacar como BA (+STR/DEX mod + 5).",
            "highlight": true
          }
        ]
      },
      "Samurai": {
        "extra": [
          {
            "name": "Fighting Spirit",
            "resource": "3 / descanso largo",
            "desc": "BA: ventaja en ataques ese turno + 5-15 HP temporales según nivel.",
            "highlight": true
          }
        ],
        "forgottenTip": "⚠️ Samurai: Fighting Spirit tiene 3 usos por descanso largo. Usalo en cada combate importante."
      },
      "Echo Knight": {
        "extra": [
          {
            "name": "Manifest Echo",
            "desc": "Eco en 15ft. Podés atacar desde su posición.",
            "highlight": true
          },
          {
            "name": "Unleash Incarnation",
            "resource": "CON mod / descanso largo",
            "desc": "Tu eco puede hacer un ataque adicional cuando atacás."
          }
        ]
      },
      "Psi Warrior": {
        "extra": [
          {
            "name": "Psionic Power",
            "resource": "Psionic Dice (d6→d12)",
            "desc": "Para movimiento extra, empuje psíquico o escudo.",
            "highlight": true
          }
        ]
      },
      "Rune Knight": {
        "extra": [
          {
            "name": "Rune Carving",
            "desc": "Runas en equipo: Fire, Frost, Stone, Storm, Hill, Cloud.",
            "highlight": true
          },
          {
            "name": "Giant's Might",
            "resource": "STR mod / descanso largo",
            "desc": "BA: tamaño Large, ventaja en STR, +1d6 o 1d8 daño."
          }
        ]
      }
    }
  },
  "barbarian": {
    "icon": "🪓",
    "role": "Berserker salvaje",
    "difficultyWarnings": [],
    "bonusActions": [
      {
        "name": "FURIA",
        "desc": "Entrás en Furia como BA. Ventaja en STR, resistencia física, bonus de daño.",
        "highlight": true
      }
    ],
    "reactions": [
      {
        "name": "Ataque de oportunidad",
        "desc": "Cuando un enemigo sale de tu alcance sin Desengancharse"
      }
    ],
    "classFeatures": [
      {
        "name": "Furia",
        "resource": "Ver hoja / descanso largo",
        "desc": "SIEMPRE activá al inicio del combate cuerpo a cuerpo.",
        "highlight": true
      },
      {
        "name": "Defensa sin Armadura",
        "desc": "CA = 10 + DEX + CON (sin armadura)."
      },
      {
        "name": "Ataque Temerario",
        "desc": "Ventaja en STR attacks, pero enemigos tienen ventaja contra vos hasta tu próximo turno."
      }
    ],
    "forgottenTip": "⚠️ El error #1 del Barbarian: entrar al combate SIN activar Furia.",
    "subclasses": {
      "Berserker": {
        "extra": [
          {
            "name": "Frenesí",
            "resource": "1/furia (con penalidad)",
            "desc": "Atacás como BA cada turno en furia. Costo: 1 nivel de agotamiento.",
            "highlight": true
          }
        ]
      },
      "Totem Warrior": {
        "extra": [
          {
            "name": "Espíritu Tótem",
            "desc": "Oso: resistencia a TODO daño en furia. Lobo: aliados con ventaja vs adyacentes. Águila: Dash como BA.",
            "highlight": true
          }
        ]
      },
      "Ancestral Guardian": {
        "extra": [
          {
            "name": "Ancestral Protectors",
            "desc": "Al atacar: el primer objetivo tiene desventaja vs aliados y ellos resistencia.",
            "highlight": true
          }
        ]
      },
      "Storm Herald": {
        "extra": [
          {
            "name": "Storm Aura",
            "desc": "En furia: Desierto (fuego), Mar (relámpago), Tundra (HP temporales).",
            "highlight": true
          }
        ]
      },
      "Zealot": {
        "extra": [
          {
            "name": "Divine Fury",
            "resource": "En furia",
            "desc": "Primer ataque: +1d6 radiante/necrótico + mitad de tu nivel.",
            "highlight": true
          },
          {
            "name": "Warrior of the Gods",
            "desc": "Resurrecciones no requieren componente material."
          }
        ]
      },
      "Beast": {
        "extra": [
          {
            "name": "Form of the Beast",
            "desc": "En furia: Mordida (1d8, recuperás HP), Garras (extra attack 1d6), Cola (reacción +1d8 CA).",
            "highlight": true
          }
        ]
      },
      "Wild Magic": {
        "extra": [
          {
            "name": "Wild Surge",
            "desc": "Al entrar en Furia: efectos aleatorios poderosos de la tabla Wild Magic.",
            "highlight": true
          }
        ]
      }
    }
  },
  "rogue": {
    "icon": "🗡️",
    "role": "Pícaro sigiloso",
    "difficultyWarnings": [],
    "bonusActions": [
      {
        "name": "Cunning Action: Dash",
        "desc": "Moverte el doble de tu velocidad"
      },
      {
        "name": "Cunning Action: Disengage",
        "desc": "Escapás sin provocar AoO",
        "highlight": true
      },
      {
        "name": "Cunning Action: Hide",
        "desc": "Esconderte para ganar ventaja en el próximo ataque"
      }
    ],
    "reactions": [
      {
        "name": "Ataque de oportunidad",
        "desc": "Cuando un enemigo sale de tu alcance"
      },
      {
        "name": "Uncanny Dodge (nivel 5)",
        "desc": "Al ser golpeado por un atacante visible: reducís el daño a la mitad.",
        "highlight": true
      }
    ],
    "classFeatures": [
      {
        "name": "Sneak Attack",
        "resource": "1 vez por TURNO",
        "desc": "Necesitás VENTAJA O aliado adyacente al enemigo sin desventaja.",
        "highlight": true
      }
    ],
    "forgottenTip": "⚠️ Sneak Attack: podés usarlo en AoO (turno del enemigo). 1 vez por turno, no por ronda.",
    "subclasses": {
      "Thief": {
        "extra": [
          {
            "name": "Fast Hands",
            "desc": "Cunning Action: usar objeto, Sleight of Hand, herramientas de ladrón."
          }
        ]
      },
      "Assassin": {
        "extra": [
          {
            "name": "Assassinate",
            "desc": "Ventaja vs quien no tomó turno aún. Críticos automáticos en sorpresa.",
            "highlight": true
          }
        ]
      },
      "Arcane Trickster": {
        "extra": [
          {
            "name": "Mage Hand Legerdemain",
            "desc": "Mage Hand como BA para Sleight of Hand a distancia."
          }
        ]
      },
      "Mastermind": {
        "extra": [
          {
            "name": "Master of Tactics",
            "desc": "Help como BA desde 30ft (no solo adyacente).",
            "highlight": true
          }
        ]
      },
      "Swashbuckler": {
        "extra": [
          {
            "name": "Fancy Footwork",
            "desc": "Al atacar en melee: el objetivo no puede hacer AoO contra vos ese turno.",
            "highlight": true
          },
          {
            "name": "Rakish Audacity",
            "desc": "Sneak Attack si estás solo con el objetivo. Iniciativa +CHA."
          }
        ]
      },
      "Scout": {
        "extra": [
          {
            "name": "Skirmisher",
            "desc": "Cuando enemigo termina turno en 5ft: movés mitad velocidad sin AoO.",
            "highlight": true
          }
        ]
      },
      "Inquisitive": {
        "extra": [
          {
            "name": "Insightful Fighting",
            "desc": "BA: Insight vs Deception del objetivo. Si ganás: Sneak Attack sin ventaja ni aliado.",
            "highlight": true
          }
        ]
      },
      "Phantom": {
        "extra": [
          {
            "name": "Wails from the Grave",
            "resource": "Proficiency / descanso largo",
            "desc": "Al SA: dañás otra criatura en 30ft con la mitad de los dados de SA (necrótico).",
            "highlight": true
          }
        ]
      },
      "Soulknife": {
        "extra": [
          {
            "name": "Psychic Blades",
            "desc": "Cuchillas psíquicas que aparecen y desaparecen. Sin evidencia.",
            "highlight": true
          }
        ]
      }
    }
  },
  "wizard": {
    "icon": "🔮",
    "role": "Lanzador arcano",
    "difficultyWarnings": [
      "Clase de complejidad ALTA",
      "Preparar hechizos requiere conocer bien tu lista",
      "Gestionar spell slots es crítico"
    ],
    "bonusActions": [
      {
        "name": "Hechizo de BA",
        "desc": "Si lanzás hechizo con BA: solo cantrips con tu acción ese turno.",
        "highlight": true
      }
    ],
    "reactions": [
      {
        "name": "Shield (nivel 1)",
        "desc": "+5 CA después de ver el dado de ataque. Gasta 1 slot nivel 1.",
        "highlight": true
      },
      {
        "name": "Counterspell (nivel 3+)",
        "desc": "Automático para hechizos nivel ≤3; tira Arcana para mayores."
      }
    ],
    "classFeatures": [
      {
        "name": "Preparar hechizos",
        "resource": "Cada descanso largo",
        "desc": "INT mod + nivel preparados de todo tu spellbook.",
        "highlight": true
      },
      {
        "name": "Arcane Recovery",
        "resource": "1/descanso largo",
        "desc": "En descanso corto: slots hasta mitad de tu nivel."
      },
      {
        "name": "Ritual Casting",
        "desc": "Rituales sin slot (+10 min)."
      }
    ],
    "forgottenTip": "⚠️ Error crítico: usar hechizos de alto nivel en los primeros encuentros. Guardá los slots de nivel 3+ para situaciones importantes.",
    "subclasses": {
      "Evocation": {
        "extra": [
          {
            "name": "Sculpt Spells (nivel 2)",
            "desc": "Excluís aliados de tus AoE. ¡Fireball en el grupo!",
            "highlight": true
          }
        ]
      },
      "Illusion": {
        "extra": [
          {
            "name": "Malleable Illusions (nivel 6)",
            "desc": "Cambiás ilusiones concentradas como acción."
          }
        ]
      },
      "Abjuration": {
        "extra": [
          {
            "name": "Arcane Ward",
            "resource": "Recarga con abjuración",
            "desc": "Escudo de PS. Se recarga al lanzar abjuración.",
            "highlight": true
          }
        ]
      },
      "Conjuration": {
        "extra": [
          {
            "name": "Benign Transposition (nivel 6)",
            "resource": "1/descanso largo",
            "desc": "Teletransportación 30ft o intercambiás lugar con aliado.",
            "highlight": true
          }
        ]
      },
      "Divination": {
        "extra": [
          {
            "name": "Portent",
            "resource": "Tira 2d20 al descansar",
            "desc": "Reemplazás CUALQUIER tirada con uno de tus resultados guardados. Usalo ANTES de que caiga el dado.",
            "highlight": true
          }
        ],
        "forgottenTip": "⚠️ Divination: guardá los extremos (1s y 20s) para momentos críticos."
      },
      "Enchantment": {
        "extra": [
          {
            "name": "Hypnotic Gaze",
            "resource": "Concentración",
            "desc": "Acción: criatura adyacente incapacitada con velocidad 0."
          },
          {
            "name": "Instinctive Charm (nivel 6)",
            "resource": "1 uso / descanso largo",
            "desc": "Reacción: redirigís ataque a otra criatura en 30ft."
          }
        ]
      },
      "Necromancy": {
        "extra": [
          {
            "name": "Grim Harvest (nivel 2)",
            "desc": "Al matar con hechizo: recuperás HP = 2× nivel del hechizo.",
            "highlight": true
          }
        ]
      },
      "Transmutation": {
        "extra": [
          {
            "name": "Transmuter's Stone",
            "desc": "Darkvision, +10 velocidad, prof CON, o resistencia a tipo de daño.",
            "highlight": true
          }
        ]
      },
      "Bladesinging": {
        "extra": [
          {
            "name": "Bladesong",
            "resource": "INT mod / descanso largo",
            "desc": "BA: +INT a CA, +10ft velocidad, ventaja Acrobacia, +INT a CON concentration saves.",
            "highlight": true
          },
          {
            "name": "Extra Attack (nivel 6)",
            "desc": "Dos ataques (uno puede ser cantrip)."
          }
        ]
      },
      "War Magic": {
        "extra": [
          {
            "name": "Arcane Deflection",
            "desc": "Reacción: +2 CA o +4 a save. Tradeoff: solo cantrips al siguiente turno.",
            "highlight": true
          }
        ]
      },
      "Order of Scribes": {
        "extra": [
          {
            "name": "Awakened Spellbook",
            "desc": "Spellbook vivo. Cambiás tipo de daño de hechizos al lanzarlos.",
            "highlight": true
          }
        ]
      }
    }
  },
  "cleric": {
    "icon": "✨",
    "role": "Clérigo divino",
    "difficultyWarnings": [
      "Complejidad media-alta: healer + combatiente + support",
      "Error más común: solo curar y olvidar el potencial ofensivo"
    ],
    "bonusActions": [
      {
        "name": "Spiritual Weapon",
        "desc": "El arma espiritual invocada ataca como BA. Sin concentración.",
        "highlight": true
      },
      {
        "name": "Healing Word",
        "desc": "BA, curación, devuelve a alguien del inconsciente sin gastar tu acción."
      }
    ],
    "reactions": [
      {
        "name": "Ataque de oportunidad",
        "desc": "Si usás armadura y armas melee"
      }
    ],
    "classFeatures": [
      {
        "name": "Channel Divinity",
        "resource": "1-3 usos / descanso corto",
        "desc": "Cada dominio tiene 2 opciones. ¡Muchos Clérigos olvidan esta habilidad!",
        "highlight": true
      },
      {
        "name": "Preparar hechizos",
        "resource": "Cada descanso largo",
        "desc": "WIS mod + nivel."
      }
    ],
    "forgottenTip": "⚠️ Error documentado: olvidar Channel Divinity y los Domain Spells. Leélos al inicio de cada sesión.",
    "subclasses": {
      "Life": {
        "extra": [
          {
            "name": "Disciple of Life",
            "desc": "Curaciones curan 2 + nivel del hechizo adicionales. Siempre activo.",
            "highlight": true
          },
          {
            "name": "Channel Divinity: Preserve Life",
            "desc": "Distribuís 5 × nivel en HP entre criaturas con menos de mitad HP."
          }
        ]
      },
      "War": {
        "extra": [
          {
            "name": "War Priest",
            "resource": "WIS mod / descanso largo",
            "desc": "BA attack cuando usás Ataque.",
            "highlight": true
          },
          {
            "name": "Channel Divinity: Guided Strike",
            "desc": "+10 a tirada de ataque."
          }
        ]
      },
      "Knowledge": {
        "extra": [
          {
            "name": "Channel Divinity: Read Thoughts",
            "desc": "Leer pensamientos superficiales. Potente en roleplay."
          }
        ]
      },
      "Light": {
        "extra": [
          {
            "name": "Warding Flare",
            "resource": "WIS mod / descanso largo",
            "desc": "Reacción: desventaja en el ataque contra vos.",
            "highlight": true
          },
          {
            "name": "Channel Divinity: Radiance of the Dawn",
            "desc": "Daño radiante a hostiles cercanos (2d10 + nivel)."
          }
        ]
      },
      "Nature": {
        "extra": [
          {
            "name": "Channel Divinity: Charm Animals and Plants",
            "desc": "Encantás animales/plantas que fallen WIS save."
          }
        ]
      },
      "Tempest": {
        "extra": [
          {
            "name": "Wrath of the Storm",
            "resource": "WIS mod / descanso largo",
            "desc": "Reacción al ser golpeado: 2d8 relámpago/trueno.",
            "highlight": true
          },
          {
            "name": "Channel Divinity: Destructive Wrath",
            "desc": "Daño máximo en hechizos de trueno/relámpago."
          }
        ]
      },
      "Trickery": {
        "extra": [
          {
            "name": "Channel Divinity: Invoke Duplicity",
            "desc": "Copia ilusoria. Lanzás hechizos como si fueras ella. Concentración.",
            "highlight": true
          }
        ]
      },
      "Arcana": {
        "extra": [
          {
            "name": "Channel Divinity: Arcane Abjuration",
            "desc": "Turn undead ampliado: también celestiales, elementales, feéricos, infernales."
          }
        ]
      },
      "Forge": {
        "extra": [
          {
            "name": "Blessing of the Forge",
            "resource": "1/descanso largo",
            "desc": "Arma o armadura no mágica se convierte en +1.",
            "highlight": true
          }
        ]
      },
      "Grave": {
        "extra": [
          {
            "name": "Circle of Mortality",
            "desc": "Curaciones en criatura a 0 HP = daño máximo automático.",
            "highlight": true
          }
        ]
      },
      "Order": {
        "extra": [
          {
            "name": "Voice of Authority",
            "desc": "Al lanzar hechizo en aliado: puede atacar con reacción.",
            "highlight": true
          }
        ]
      },
      "Peace": {
        "extra": [
          {
            "name": "Emboldening Bond",
            "resource": "Proficiency / descanso largo",
            "desc": "Vinculás criaturas: +1d4 en ataques/checks/saves mientras estén a 30ft.",
            "highlight": true
          },
          {
            "name": "Channel Divinity: Balm of Peace",
            "desc": "Movés tu velocidad sin AoO, curando 2d6+WIS a cada criatura que toqués."
          }
        ]
      },
      "Twilight": {
        "extra": [
          {
            "name": "Channel Divinity: Twilight Sanctuary",
            "desc": "Aura 30ft, 1 min: cada turno HP temporales (1d6+nivel) o terminar encantamiento/miedo.",
            "highlight": true
          }
        ]
      },
      "Death": {
        "extra": [
          {
            "name": "Reaper",
            "desc": "Cantrips de un objetivo afectan a UNA criatura extra en 5ft.",
            "highlight": true
          }
        ]
      }
    }
  },
  "paladin": {
    "icon": "🛡️",
    "role": "Paladín sagrado",
    "difficultyWarnings": [
      "Híbrido combate + magia",
      "Gestionar spell slots Y Lay on Hands puede abrumar"
    ],
    "bonusActions": [
      {
        "name": "Divine Smite",
        "desc": "NO es BA — se activa DESPUÉS de golpear. Gastás slot para daño radiante extra.",
        "highlight": true
      },
      {
        "name": "Smites de hechizo",
        "desc": "Thunderous Smite, Wrathful Smite: ESTOS son BA, se activan ANTES del ataque."
      }
    ],
    "reactions": [
      {
        "name": "Ataque de oportunidad",
        "desc": "Con STR/CHA altos, una de las mejores del grupo"
      }
    ],
    "classFeatures": [
      {
        "name": "Divine Smite",
        "resource": "Gasta spell slots",
        "desc": "Se activa al IMPACTAR. Decidís smite DESPUÉS de ver el dado.",
        "highlight": true
      },
      {
        "name": "Lay on Hands",
        "resource": "5 × nivel / descanso largo",
        "desc": "Pool de curación. Cura enfermedades/venenos (cuesta 5 pts)."
      },
      {
        "name": "Aura of Protection (nivel 6)",
        "desc": "CHA mod (mín +1) a todas las saves de aliados en 10ft. ¡Siempre activa!",
        "highlight": true
      }
    ],
    "forgottenTip": "⚠️ Confundir Thunderous Smite (BA, ANTES) con Divine Smite (DESPUÉS de impactar) es el error clásico.",
    "subclasses": {
      "Oath of Devotion": {
        "extra": [
          {
            "name": "Channel Divinity: Sacred Weapon",
            "desc": "+CHA mod a ataques por 1 minuto."
          }
        ]
      },
      "Oath of Vengeance": {
        "extra": [
          {
            "name": "Vow of Enmity",
            "resource": "Channel Divinity",
            "desc": "Ventaja en todos tus ataques contra un objetivo. Devastador con Smite.",
            "highlight": true
          }
        ]
      },
      "Oath of the Ancients": {
        "extra": [
          {
            "name": "Aura of Warding (nivel 7)",
            "desc": "Vos y aliados en 10ft: resistencia a daño de hechizos.",
            "highlight": true
          }
        ]
      },
      "Oath of Conquest": {
        "extra": [
          {
            "name": "Aura of Conquest (nivel 7)",
            "desc": "Criaturas asustadas en 10ft: velocidad 0 + daño psíquico por turno.",
            "highlight": true
          }
        ]
      },
      "Oath of Redemption": {
        "extra": [
          {
            "name": "Rebuke the Violent (nivel 7)",
            "desc": "Reacción al daño en aliado: el atacante recibe el mismo daño radiante.",
            "highlight": true
          }
        ]
      },
      "Oath of Glory": {
        "extra": [
          {
            "name": "Channel Divinity: Inspiring Smite",
            "desc": "Tras Divine Smite: distribuís 2d8+nivel en HP temporales entre criaturas visibles.",
            "highlight": true
          }
        ]
      },
      "Oathbreaker": {
        "extra": [
          {
            "name": "Aura of Hate (nivel 7)",
            "desc": "Vos y undead/fiends amigos en 10ft: +CHA mod a daño melee.",
            "highlight": true
          }
        ]
      }
    }
  },
  "ranger": {
    "icon": "🏹",
    "role": "Explorador del bosque",
    "difficultyWarnings": [
      "Complejidad media: habilidades situacionales",
      "Favored Enemy y Natural Explorer dependen del DM"
    ],
    "bonusActions": [
      {
        "name": "Hunter's Mark (mover)",
        "desc": "BA para mover la marca al siguiente objetivo cuando el marcado muere."
      }
    ],
    "reactions": [
      {
        "name": "Ataque de oportunidad",
        "desc": "Con arma melee"
      }
    ],
    "classFeatures": [
      {
        "name": "Hunter's Mark",
        "resource": "Usa Concentración",
        "desc": "Daño extra vs objetivo marcado. Requiere CON save si tomás daño.",
        "highlight": true
      }
    ],
    "forgottenTip": "⚠️ Hunter's Mark requiere Concentración. Elegí entre Mark y otros hechizos de concentración.",
    "subclasses": {
      "Hunter": {
        "extra": [
          {
            "name": "Hunter's Prey",
            "desc": "Colossus Slayer (1d8 extra/turno), Giant Killer (reacción), o Horde Breaker (segundo objetivo adyacente).",
            "highlight": true
          }
        ]
      },
      "Beast Master": {
        "extra": [
          {
            "name": "Ranger's Companion",
            "desc": "Tu animal usa su REACCIÓN para atacar cuando vos atacás."
          }
        ]
      },
      "Gloom Stalker": {
        "extra": [
          {
            "name": "Dread Ambusher",
            "desc": "Primera ronda: +10ft velocidad, ataque extra, +1d8 en ese ataque.",
            "highlight": true
          },
          {
            "name": "Umbral Sight",
            "desc": "Invisible para criaturas con darkvision en oscuridad."
          }
        ],
        "forgottenTip": "⚠️ Gloom Stalker es la subclase de Ranger más fuerte. La primera ronda con sorpresa puede acabar encuentros."
      },
      "Horizon Walker": {
        "extra": [
          {
            "name": "Planar Warrior",
            "resource": "BA",
            "desc": "Designás objetivo: primer golpe hace fuerza de daño + 1d8 fuerza extra.",
            "highlight": true
          }
        ]
      },
      "Monster Slayer": {
        "extra": [
          {
            "name": "Slayer's Prey",
            "desc": "BA: marcás objetivo. Primer ataque por turno: +1d6 daño.",
            "highlight": true
          }
        ]
      },
      "Fey Wanderer": {
        "extra": [
          {
            "name": "Dreadful Strikes",
            "desc": "+1d4 daño psíquico por ataque (+1d6 en nivel 11). 1 vez por turno.",
            "highlight": true
          }
        ]
      },
      "Swarmkeeper": {
        "extra": [
          {
            "name": "Gathered Swarm",
            "desc": "Al golpear: elegís empujar 15ft, mover al objetivo, o daño piercing adicional.",
            "highlight": true
          }
        ]
      }
    }
  },
  "warlock": {
    "icon": "👁️",
    "role": "Pactante del más allá",
    "difficultyWarnings": [
      "⚠️ ALTA complejidad",
      "Eldritch Invocations son fáciles de olvidar",
      "Spell slots se recuperan en descanso CORTO"
    ],
    "bonusActions": [],
    "reactions": [
      {
        "name": "Counterspell",
        "desc": "Interrumpís un hechizo enemigo."
      }
    ],
    "classFeatures": [
      {
        "name": "Eldritch Blast",
        "resource": "Cantrip — sin límite",
        "desc": "Con Agonizing Blast (+CHA al daño) es tu DPS central. Recordá tus invocaciones modificadoras.",
        "highlight": true
      },
      {
        "name": "Spell Slots",
        "resource": "Descanso CORTO",
        "desc": "1-2 slots de alto nivel. Pedí descansos cortos frecuentemente.",
        "highlight": true
      },
      {
        "name": "Eldritch Invocations",
        "desc": "Siempre activas. Listalas donde las veas."
      }
    ],
    "forgottenTip": "⚠️ El error #1 del Warlock: olvidar pedir descansos CORTOS para recuperar los spell slots.",
    "subclasses": {
      "The Fiend": {
        "extra": [
          {
            "name": "Dark One's Blessing",
            "desc": "Al matar hostil: CHA mod + nivel Warlock en HP temporales.",
            "highlight": true
          }
        ]
      },
      "The Archfey": {
        "extra": [
          {
            "name": "Fey Presence",
            "resource": "1/descanso corto",
            "desc": "Criaturas en 10ft: WIS save o charmadas/asustadas por 1 turno."
          }
        ]
      },
      "The Great Old One": {
        "extra": [
          {
            "name": "Awakened Mind",
            "desc": "Telepática con criatura visible en 30ft."
          }
        ]
      },
      "The Celestial": {
        "extra": [
          {
            "name": "Healing Light",
            "resource": "1+nivel dados d6 / descanso largo",
            "desc": "BA: gastás dados del pool para curar en 60ft.",
            "highlight": true
          }
        ]
      },
      "The Hexblade": {
        "extra": [
          {
            "name": "Hexblade's Curse",
            "resource": "1/descanso corto",
            "desc": "BA: +prof al daño, crit 19-20, al matarlo recuperás HP = nivel + CHA mod.",
            "highlight": true
          },
          {
            "name": "Hex Warrior",
            "desc": "Proficiencia en armadura media, escudos, armas marciales. CHA para atacar con un arma marcial."
          }
        ],
        "forgottenTip": "⚠️ Hexblade: usá CHA para TODO — ataque, daño, AC (si tomás Pact of the Blade)."
      },
      "The Fathomless": {
        "extra": [
          {
            "name": "Tentacle of the Deeps",
            "resource": "1/descanso largo",
            "desc": "BA: tentáculo en 60ft. Hostiles en 10ft: 1d8 frío y −10ft velocidad.",
            "highlight": true
          }
        ]
      },
      "The Genie": {
        "extra": [
          {
            "name": "Genie's Vessel",
            "desc": "Bottled Respite (entrar a descansar), Genie's Wrath (daño extra por tipo), eventual Wish.",
            "highlight": true
          }
        ]
      }
    }
  },
  "bard": {
    "icon": "🎸",
    "role": "Bardo inspirador",
    "difficultyWarnings": [
      "Complejidad alta para nuevos jugadores",
      "Support activo — pensás en tus aliados"
    ],
    "bonusActions": [
      {
        "name": "Bardic Inspiration",
        "resource": "CHA mod / descanso largo (corto nv5)",
        "desc": "Dado (d6→d12) a un aliado para ataque, save o check. ¡Distribuílos antes del combate!",
        "highlight": true
      },
      {
        "name": "Healing Word",
        "desc": "BA, curación, devuelve del inconsciente."
      }
    ],
    "reactions": [
      {
        "name": "Cutting Words (nivel 3)",
        "desc": "Gastás dado de Inspiración para RESTAR el resultado a ataque/check/daño del enemigo.",
        "highlight": true
      }
    ],
    "classFeatures": [
      {
        "name": "Bardic Inspiration",
        "resource": "CHA mod / descanso",
        "desc": "Distribuílos al inicio. Recurso central.",
        "highlight": true
      },
      {
        "name": "Jack of All Trades (nivel 2)",
        "desc": "Mitad prof a skills sin proficiencia. ¡Siempre aplica!"
      }
    ],
    "forgottenTip": "⚠️ Guardar Bardic Inspiration para 'el momento perfecto' y nunca usarlos. Se recuperan en descanso. ¡Usálos!",
    "subclasses": {
      "Lore": {
        "extra": [
          {
            "name": "Cutting Words",
            "desc": "Resta dado de Inspiración a tirada de enemigo.",
            "highlight": true
          },
          {
            "name": "Additional Magical Secrets (nivel 6)",
            "desc": "2 hechizos de CUALQUIER clase."
          }
        ]
      },
      "Valor": {
        "extra": [
          {
            "name": "Combat Inspiration",
            "desc": "Dados de Inspiración también para CA (reacción) o daño."
          },
          {
            "name": "Extra Attack (nivel 6)",
            "desc": "Dos ataques por Acción."
          }
        ]
      },
      "Swords": {
        "extra": [
          {
            "name": "Blade Flourish",
            "desc": "Al atacar: dado de Inspiración para Defensive (+CA), Slashing (área), o Mobile (+mov, sin AoO).",
            "highlight": true
          },
          {
            "name": "Extra Attack (nivel 6)",
            "desc": "Dos ataques por Acción."
          }
        ]
      },
      "Glamour": {
        "extra": [
          {
            "name": "Mantle of Inspiration",
            "resource": "Gasta dado de Inspiración",
            "desc": "BA: aliados en 60ft ganan HP temporales + pueden moverse su velocidad sin AoO.",
            "highlight": true
          }
        ]
      },
      "Whispers": {
        "extra": [
          {
            "name": "Psychic Blades",
            "resource": "Gasta dado de Inspiración",
            "desc": "Al impactar: daño psíquico extra = dado. Objetivo asustado hasta su próximo turno.",
            "highlight": true
          }
        ]
      },
      "Creation": {
        "extra": [
          {
            "name": "Performance of Creation",
            "resource": "CHA mod / descanso largo",
            "desc": "BA: creás objeto hasta 20gp × nivel de Bard. Dura horas.",
            "highlight": true
          }
        ]
      },
      "Eloquence": {
        "extra": [
          {
            "name": "Silver Tongue",
            "desc": "Mínimo 10 en Persuasión y Engaño.",
            "highlight": true
          }
        ]
      }
    }
  },
  "druid": {
    "icon": "🌿",
    "role": "Druida de la naturaleza",
    "difficultyWarnings": [
      "⚠️ Mayor complejidad del juego para nuevos jugadores",
      "Wild Shape requiere conocer estadísticas de bestias",
      "Preparar hechizos de lista enorme es exigente"
    ],
    "bonusActions": [
      {
        "name": "Wild Shape",
        "desc": "Nivel 2: Acción. Moon Druid nivel 2+: Acción Adicional.",
        "highlight": true
      }
    ],
    "reactions": [
      {
        "name": "Ataque de oportunidad",
        "desc": "En forma humana y en Wild Shape"
      }
    ],
    "classFeatures": [
      {
        "name": "Wild Shape",
        "resource": "2 usos / descanso corto",
        "desc": "Los HP de la bestia son un buffer. Al llegar a 0, volvés con tus HP anteriores.",
        "highlight": true
      },
      {
        "name": "Spellcasting",
        "resource": "Descanso largo",
        "desc": "WIS mod + nivel preparados."
      }
    ],
    "forgottenTip": "⚠️ Wild Shape: en forma de bestia NO podés lanzar hechizos (salvo Moon Druid nivel 18).",
    "subclasses": {
      "Moon": {
        "extra": [
          {
            "name": "Combat Wild Shape (nivel 2)",
            "desc": "Transformación como BA. Bestias de CR mucho más alto.",
            "highlight": true
          },
          {
            "name": "Wildshape Healing",
            "resource": "Gasta spell slot",
            "desc": "En Wild Shape: BA para recuperar 1d8 HP por nivel del slot."
          }
        ]
      },
      "Land": {
        "extra": [
          {
            "name": "Natural Recovery",
            "resource": "1/descanso largo",
            "desc": "En descanso corto: slots hasta mitad de tu nivel."
          },
          {
            "name": "Circle Spells",
            "desc": "Hechizos siempre preparados según terreno. Sin gastar preparaciones.",
            "highlight": true
          }
        ]
      },
      "Dreams": {
        "extra": [
          {
            "name": "Balm of the Summer Court",
            "resource": "WIS mod × nivel dados / descanso largo",
            "desc": "BA: gastás dados para curar aliados visibles en 120ft.",
            "highlight": true
          }
        ]
      },
      "Spores": {
        "extra": [
          {
            "name": "Halo of Spores",
            "desc": "Reacción al entrar en 10ft: 1d4 necrótico (escala).",
            "highlight": true
          },
          {
            "name": "Symbiotic Entity",
            "resource": "2 usos Wild Shape",
            "desc": "HP temporales 4×nivel, Halo +1d6, ataques con arma +1d6 necrótico."
          }
        ],
        "forgottenTip": "⚠️ Symbiotic Entity es mejor que Wild Shape en combate muchas veces porque podés seguir lanzando hechizos."
      },
      "Stars": {
        "extra": [
          {
            "name": "Starry Form",
            "resource": "2 usos Wild Shape",
            "desc": "Archer (cantrip + 1d8+WIS curación), Chalice (curación en hechizos), Dragon (concentración con ventaja).",
            "highlight": true
          }
        ]
      },
      "Wildfire": {
        "extra": [
          {
            "name": "Summon Wildfire Spirit",
            "resource": "2 usos Wild Shape",
            "desc": "Espíritu de fuego: teleporta, ataca, y potencia tus hechizos.",
            "highlight": true
          }
        ]
      },
      "Shepherd": {
        "extra": [
          {
            "name": "Spirit Totem",
            "resource": "1/descanso corto",
            "desc": "BA: espíritu en 60ft. Bear (HP temp), Hawk (ventaja en ataques), Unicorn (curación potenciada).",
            "highlight": true
          }
        ]
      }
    }
  },
  "monk": {
    "icon": "👊",
    "role": "Monje marcial",
    "difficultyWarnings": [
      "Complejidad media-alta: Ki Points son un recurso frágil"
    ],
    "bonusActions": [
      {
        "name": "Flurry of Blows",
        "resource": "1 Ki Point",
        "desc": "Después de Ataque: dos golpes sin armas adicionales.",
        "highlight": true
      },
      {
        "name": "Patient Defense",
        "resource": "1 Ki Point",
        "desc": "Dodge como BA."
      },
      {
        "name": "Step of the Wind",
        "resource": "1 Ki Point",
        "desc": "Dash o Disengage como BA. Velocidad doble."
      }
    ],
    "reactions": [
      {
        "name": "Deflect Missiles (nivel 3)",
        "desc": "Reducís daño de proyectil 1d10+DEX+nivel. A 0: podés lanzarlo de vuelta.",
        "highlight": true
      }
    ],
    "classFeatures": [
      {
        "name": "Ki Points",
        "resource": "= nivel / descanso corto",
        "desc": "Tu recurso central. Se recuperan en descanso CORTO.",
        "highlight": true
      },
      {
        "name": "Martial Arts",
        "desc": "DEX para atacar. Después de atacar con arma: ataque sin arma gratis como BA."
      },
      {
        "name": "Stunning Strike (nivel 5)",
        "resource": "1 Ki Point",
        "desc": "Después de golpear: CON save o Stunned hasta tu próximo turno.",
        "highlight": true
      }
    ],
    "forgottenTip": "⚠️ Monk: gastar Ki en Flurry constantemente y no tener para Stunning Strike cuando aparece el jefe.",
    "subclasses": {
      "Way of the Open Hand": {
        "extra": [
          {
            "name": "Open Hand Technique",
            "desc": "Con Flurry: empujar 15ft, prono, o prevenir reacciones.",
            "highlight": true
          }
        ]
      },
      "Way of Shadow": {
        "extra": [
          {
            "name": "Shadow Arts",
            "resource": "Ki Points",
            "desc": "Pass Without Trace, Silence, Darkness, Darkvision con Ki."
          },
          {
            "name": "Shadow Step (nivel 6)",
            "desc": "BA: teletransportación entre oscuridad. Ventaja en primer ataque."
          }
        ]
      },
      "Way of the Four Elements": {
        "extra": [
          {
            "name": "Elemental Disciplines",
            "desc": "Gastás Ki para efectos elementales: Fangs of Fire Snake, Fist of Unbroken Air, Rush of Gale, Shape Flowing River...",
            "highlight": true
          }
        ],
        "forgottenTip": "⚠️ Four Elements: los Disciplines son costosos en Ki. Usálos selectivamente."
      },
      "Way of the Drunken Master": {
        "extra": [
          {
            "name": "Drunken Technique",
            "desc": "Con Flurry: beneficio de Dodge + 10ft de movimiento ese turno.",
            "highlight": true
          }
        ]
      },
      "Way of the Kensei": {
        "extra": [
          {
            "name": "Path of the Kensei",
            "desc": "Armas elegidas como Kensei (pueden ser no-monk). Melee: +2 CA si la sostenés.",
            "highlight": true
          }
        ]
      },
      "Way of the Sun Soul": {
        "extra": [
          {
            "name": "Radiant Sun Bolt",
            "desc": "Cantrip de rayo radiante a distancia. Gastás Ki para ataques adicionales.",
            "highlight": true
          }
        ]
      },
      "Way of the Astral Self": {
        "extra": [
          {
            "name": "Arms of the Astral Self",
            "resource": "1 Ki Point",
            "desc": "BA: brazos astrales. WIS para ataques en lugar de STR/DEX. Alcance 5ft.",
            "highlight": true
          }
        ]
      },
      "Way of Mercy": {
        "extra": [
          {
            "name": "Hands of Healing",
            "resource": "1 Ki Point",
            "desc": "BA o con Flurry: curación 1d10+WIS."
          },
          {
            "name": "Hands of Harm",
            "resource": "1 Ki Point",
            "desc": "Con Martial Arts: +1d6+WIS necrótico + enfermedad.",
            "highlight": true
          }
        ]
      }
    }
  },
  "sorcerer": {
    "icon": "🌟",
    "role": "Lanzador innato",
    "difficultyWarnings": [
      "Spell slots limitados y lista fija — no podés cambiar hechizos a diario",
      "Administrar Sorcery Points es clave"
    ],
    "bonusActions": [
      {
        "name": "Quickened Spell",
        "resource": "2 Sorcery Points",
        "desc": "Lanzás un hechizo de Acción como Acción Adicional.",
        "highlight": true
      }
    ],
    "reactions": [
      {
        "name": "Ataque de oportunidad",
        "desc": "Disponible pero raramente conveniente"
      }
    ],
    "classFeatures": [
      {
        "name": "Sorcery Points",
        "resource": "= nivel / descanso largo",
        "desc": "Convertís slots en SP (1 pt/nivel) y viceversa. Base para Metamagic.",
        "highlight": true
      },
      {
        "name": "Metamagic",
        "resource": "Gasta Sorcery Points",
        "desc": "Elegís 2 al nivel 3: Twinned (mismo hechizo en 2 blancos), Quickened (BA), Subtle (sin componentes verbales), Empowered, Heightened, Extended, Careful, Distant.",
        "highlight": true
      },
      {
        "name": "Spells Known",
        "desc": "Lista fija. No cambiás entre sesiones. Elegí bien — son tu identidad."
      }
    ],
    "forgottenTip": "⚠️ Error clásico: olvidar las Metamagic. Quickened + Fireball o Twinned + Haste definen la clase.",
    "subclasses": {
      "Draconic Bloodline": {
        "extra": [
          {
            "name": "Draconic Resilience",
            "desc": "CA base 13 + DEX sin armadura. +1 HP por nivel.",
            "highlight": true
          },
          {
            "name": "Elemental Affinity (nivel 6)",
            "desc": "+CHA mod de daño del tipo dracónico elegido."
          }
        ]
      },
      "Wild Magic": {
        "extra": [
          {
            "name": "Wild Magic Surge",
            "desc": "1 en d20 tras lanzar hechizo: tabla Wild Magic. Efectos caóticos.",
            "highlight": true
          },
          {
            "name": "Tides of Chaos",
            "resource": "1/descanso largo",
            "desc": "Ventaja en ataque, check o save. Puede provocar Wild Surge."
          }
        ],
        "forgottenTip": "⚠️ Tides of Chaos es tremendo. No lo guardés para 'más adelante' — usalo."
      },
      "Shadow Magic": {
        "extra": [
          {
            "name": "Eyes of the Dark",
            "resource": "1 Sorcery Point",
            "desc": "Darkvision 120ft. Darkness sin materiales y podés ver a través.",
            "highlight": true
          },
          {
            "name": "Strength of the Grave",
            "resource": "1/descanso largo",
            "desc": "Al bajar a 0 HP: CHA save → quedás en 1 HP."
          }
        ]
      },
      "Divine Soul": {
        "extra": [
          {
            "name": "Divine Magic",
            "desc": "Acceso a hechizos de Clérigo además de Sorcerer.",
            "highlight": true
          }
        ]
      },
      "Storm Sorcery": {
        "extra": [
          {
            "name": "Tempestuous Magic",
            "desc": "Tras lanzar hechizo nivel 1+: volás 10ft como BA sin AoO."
          }
        ]
      },
      "Aberrant Mind": {
        "extra": [
          {
            "name": "Psionic Spells",
            "desc": "Lista expandida psíquica siempre conocida. No gastan tu cupo.",
            "highlight": true
          }
        ]
      },
      "Clockwork Soul": {
        "extra": [
          {
            "name": "Restore Balance",
            "resource": "CHA mod / descanso largo",
            "desc": "Reacción: cancelás ventaja o desventaja en cualquier tirada que veas.",
            "highlight": true
          }
        ]
      }
    }
  }
};

export const FEAT_NOTES: Record<string, FeatNote> = {
  "Alert": {
    "icon": "👁️",
    "category": "passive",
    "desc": "+5 a iniciativa. No podés ser sorprendido mientras estés consciente. Las criaturas ocultas no tienen ventaja en sus ataques contra vos."
  },
  "Great Weapon Master": {
    "icon": "🪓",
    "category": "active",
    "highlight": true,
    "resource": "Por ataque",
    "desc": "Podés tomar −5 a la tirada de ataque para +10 de daño con arma pesada. Cuando hacés un crítico o matás una criatura, podés hacer 1 ataque adicional como Acción Adicional.",
    "tip": "Usalo cuando tenés ventaja (Barbarian Reckless, Faerie Fire, Restrained) para compensar el −5."
  },
  "Sharpshooter": {
    "icon": "🎯",
    "category": "active",
    "highlight": true,
    "resource": "Por ataque",
    "desc": "Podés tomar −5 a la tirada de ataque para +10 de daño con arma a distancia. Ignorás cobertura media y total. No tenés desventaja por rango largo.",
    "tip": "Con Archery Fighting Style (+2 al ataque) el −5 efectivo es solo −3. Combiná con Crossbow Expert."
  },
  "Crossbow Expert": {
    "icon": "🏹",
    "category": "bonus_action",
    "highlight": true,
    "resource": "Acción Adicional",
    "desc": "Ignorás el rasgo Loading. No tenés desventaja en ataques a distancia cuando hay criatura hostil en 5ft. Después de usar la Acción de Ataque con ballesta de mano, podés atacar con ella de nuevo como BA.",
    "tip": "El ataque de BA no tiene el bonus de STR/DEX al daño (cero adicional). Pero con Sharpshooter es +10 de daño base."
  },
  "Polearm Master": {
    "icon": "🪖",
    "category": "bonus_action",
    "highlight": true,
    "resource": "BA + Reacción",
    "desc": "Después de usar Ataque con alabarda/lanza/quarterstaff/glaive: BA para atacar con el extremo opuesto (1d4 contundente). Los enemigos que entren a tu alcance (10ft) provocan un Ataque de Oportunidad.",
    "tip": "Combinado con Sentinel: los enemigos no pueden ni acercarse ni alejarse."
  },
  "Sentinel": {
    "icon": "🛡️",
    "category": "reaction",
    "highlight": true,
    "resource": "Reacción",
    "desc": "Cuando golpeás a un enemigo con Ataque de Oportunidad: su velocidad baja a 0 ese turno. Podés hacer AoO aunque el enemigo use Disengage. Podés hacer AoO cuando un enemigo ataca a un aliado adyacente a vos.",
    "tip": "Con PAM: OA cuando entran, velocidad a 0, quedan en tu reach. Con War Caster: lanzás un hechizo como OA."
  },
  "War Caster": {
    "icon": "✨",
    "category": "reaction",
    "highlight": true,
    "resource": "Pasivo + Reacción",
    "desc": "Ventaja en tiradas de CON para mantener Concentración. Podés realizar componentes somáticos con manos llenas (arma + escudo). Podés lanzar un hechizo como Ataque de Oportunidad (en lugar de un ataque).",
    "tip": "Sentinel + War Caster = podés lanzar Shocking Grasp o Hold Person como AoO y inmovilizás al enemigo."
  },
  "Shield Master": {
    "icon": "🛡",
    "category": "bonus_action",
    "resource": "BA + Reacción",
    "desc": "Después de usar Ataque: podés intentar empujar a una criatura en 5ft como BA (usar STR o DEX, según rules). Tu bono de escudo se aplica a tiradas de DEX save. Si pasás un DEX save por mitad de daño: no recibís nada.",
    "tip": "Empujar como BA es gratis (no gasta acción). Tirá al enemigo al suelo (prono) para dar ventaja al grupo."
  },
  "Lucky": {
    "icon": "🍀",
    "category": "passive",
    "highlight": true,
    "resource": "3 puntos / descanso largo",
    "desc": "Gastás un punto de suerte para tirar un dado adicional en cualquier ataque, check o save tuyo, o en una tirada de ataque contra vos. Elegís cuál de los dos resultados usar.",
    "tip": "Tres rerolls por descanso largo es tremendo. Guardá al menos uno para el save de concentración o el ataque que decide el combate."
  },
  "Mobile": {
    "icon": "💨",
    "category": "passive",
    "resource": "Pasivo",
    "desc": "+10ft de velocidad. Cuando usás la acción de Dash, el terreno difícil no te cuesta movimiento extra. Cuando atacás a una criatura en cuerpo a cuerpo (impactes o no), no provoca AoO contra vos ese turno.",
    "tip": "Rogue: atacá con SA y alejate sin provocar AoO. No necesitás Disengage."
  },
  "Mage Slayer": {
    "icon": "⚔️✨",
    "category": "reaction",
    "resource": "Reacción",
    "desc": "Cuando una criatura en 5ft lanza un hechizo: podés atacarla con tu reacción. Tenés ventaja en saves contra hechizos de criaturas a 5ft. Cuando dañás a un concentrador: tiene desventaja en el CON save.",
    "tip": "Ideal para tanques cuerpo a cuerpo. Empujá a los spellcasters hacia vos y que aprendan lo que cuesta lanzar."
  },
  "Defensive Duelist": {
    "icon": "🤺",
    "category": "reaction",
    "resource": "Reacción",
    "desc": "Cuando te atacan con arma cuerpo a cuerpo y estás sosteniendo un arma finesse: podés agregar tu bono de proficiencia a la CA para ese ataque.",
    "tip": "Perfecto para Rogues y Fighters que usan rapier. Stackea con Shield si tenés War Caster."
  },
  "Inspiring Leader": {
    "icon": "📣",
    "category": "passive",
    "resource": "6 criaturas / descanso corto",
    "desc": "Después de un descanso corto de 10 minutos: hasta 6 criaturas que podés ver y que te escuchan ganan HP temporales = CHA modifier + nivel.",
    "tip": "Pre-buffeo SIEMPRE antes de un dungeon o combate conocido. Es la mejor forma de dar HP gratis al grupo."
  },
  "Dual Wielder": {
    "icon": "⚔️⚔️",
    "category": "passive",
    "resource": "Pasivo",
    "desc": "+1 CA mientras sostenés dos armas. Podés usar armas de una mano que NO sean ligeras para Two-Weapon Fighting. Podés desenvainar o envainar dos armas en una interacción.",
    "tip": "Permite usar Longsword + Longsword (1d8+1d8) en lugar de dos armas ligeras (1d6+1d6). Más daño."
  },
  "Tavern Brawler": {
    "icon": "👊",
    "category": "bonus_action",
    "resource": "BA",
    "desc": "Proficiencia con armas improvisadas y ataques sin arma. Cuando golpeás con estas: podés intentar agarrar (grapple) a la criatura como BA.",
    "tip": "Agarra → prono → el aliado adyacente tiene ventaja. Muy efectivo para Fighters y Monks."
  },
  "Charger": {
    "icon": "🏃",
    "category": "bonus_action",
    "resource": "BA (tras Dash)",
    "desc": "Cuando usás la acción de Dash: podés hacer un ataque cuerpo a cuerpo como BA (+5 de daño) o empujar 10ft a la criatura.",
    "tip": "Menos útil en combates cortos pero potente para la primera ronda de combate si arrancás lejos."
  },
  "Martial Adept": {
    "icon": "⚔️📚",
    "category": "active",
    "resource": "1d6 superioridad / descanso largo",
    "desc": "Aprendés 2 Maniobras de Battle Master. Ganás 1 dado de superioridad (d6). Se recupera en descanso largo.",
    "tip": "Trip Attack (tirar prono para dar ventaja al grupo) o Precision Attack (sumar el dado a un ataque fallado) son las mejores opciones."
  },
  "Resilient (CON)": {
    "icon": "💪",
    "category": "passive",
    "resource": "Pasivo",
    "desc": "+1 a CON. Proficiencia en tiradas de salvación de Constitución.",
    "tip": "Vital para spellcasters de concentración. Combinado con War Caster: casi imposible perder concentración."
  },
  "Savage Attacker": {
    "icon": "🩸",
    "category": "passive",
    "resource": "1 vez por turno",
    "desc": "Una vez por turno cuando hacés daño con arma cuerpo a cuerpo: volvés a tirar los dados de daño y usás el resultado más alto.",
    "tip": "Más valioso con dados de daño grandes (2H/Greatsword 2d6 o Maul 2d6). Promedio de mejora ~3-4 daño."
  },
  "Spell Sniper": {
    "icon": "🔭",
    "category": "passive",
    "resource": "Pasivo",
    "desc": "Doblás el rango de hechizos que requieren tirada de ataque. Ignorás cobertura media y total para hechizos de ataque. Aprendés 1 cantrip de ataque de cualquier lista.",
    "tip": "Eldritch Blast a 240ft (en vez de 120ft) ignorando cobertura. Ideal para Warlock."
  },
  "Tough": {
    "icon": "❤️",
    "category": "passive",
    "resource": "Pasivo",
    "desc": "+2 HP por cada nivel (incluyendo los anteriores). En nivel 10 ya son +20 HP máximos.",
    "tip": "Parece simple pero es enorme. En nivel 5 son +10 HP — equivalente a tener un nivel extra de HP."
  },
  "Magic Initiate": {
    "icon": "📖",
    "category": "active",
    "resource": "Ver hechizos elegidos",
    "desc": "Elegís una clase de hechizos: aprendés 2 cantrips y 1 hechizo de nivel 1 (una vez por descanso largo sin slot).",
    "tip": "Find Familiar (Wizard) + cualquier clase es brutal. O Healing Word (Cleric) para un Fighter no-mágico."
  }
};

export const COMBO_NOTES: ComboNote[] = [
  {
    "id": "sorlock",
    "name": "Sorlock",
    "icon": "👁️🌟",
    "tags": [
      "multiclase",
      "infinito",
      "famoso"
    ],
    "what": "La combinación multiclase más famosa. Convertís Warlock spell slots en Sorcery Points y luego en nuevos slots → recursos casi infinitos + Metamagic.",
    "how": "Quicken Spell (2 SP) en Eldritch Blast → 2 blasts por turno (Acción + BA). Con Agonizing Blast (+CHA en cada beam). Usá el Warlock slot para recargar SP y repetí.",
    "highlight": true
  },
  {
    "id": "hexadin",
    "name": "Hexadin",
    "icon": "🛡️👁️",
    "tags": [
      "multiclase",
      "smite"
    ],
    "what": "Paladin + Hexblade Warlock. Usás CHA para todo (ataque, daño, CA con Hexblade + Pact), y los Warlock slots se recargan en descanso corto para más Divine Smites.",
    "how": "Hexblade's Curse marca al objetivo (+prof al daño, crit 19-20). Warlock slots → Smite. Short rest → shorts vuelven. 2-3 niveles de Warlock son suficientes.",
    "highlight": true
  },
  {
    "id": "gwm_reckless",
    "name": "GWM + Reckless Attack",
    "icon": "🪓💥",
    "tags": [
      "daño",
      "barbarian"
    ],
    "what": "Barbarian + Great Weapon Master. Usás Reckless Attack (ventaja en STR attacks) para compensar el −5 del feat. El resultado neto es +10 de daño sin penalidad real.",
    "how": "Entra en Furia → Reckless Attack → GWM activo. En nivel 5 (Extra Attack) son 2 swings de 2d6+STR+rage+10 = ~35+ daño por turno. El sueño húmedo de todo Barbarian.",
    "highlight": true
  },
  {
    "id": "gwm_action_surge",
    "name": "GWM + Action Surge",
    "icon": "⚔️⚡",
    "tags": [
      "daño",
      "fighter",
      "burst"
    ],
    "what": "Fighter + GWM. Action Surge te da una acción completa extra → 4 ataques en 1 turno todos con +10 de daño.",
    "how": "Nivel 5+: Acción (2 ataques) + Action Surge (2 ataques) = 4 ataques × (daño+10). Si alguno crita: BA attack de GWM = 5to ataque. Contra jefes esto es devastador.",
    "highlight": true
  },
  {
    "id": "sharpshooter_archery",
    "name": "Sharpshooter + Archery Style",
    "icon": "🎯🏹",
    "tags": [
      "daño",
      "ranged",
      "fighter",
      "ranger"
    ],
    "what": "Archery Fighting Style (+2 a ataques) reduce el penalizador de Sharpshooter a efectivamente −3. Con ventaja es casi neutro. Con Crossbow Expert: también BA attack.",
    "how": "La penalidad real de SS es −3 (−5 offset por +2 Archery). En nivel 5 con Extra Attack: 2 ataques × (daño+10) a distancia, ignorando cobertura. Limpiá líneas de enemigos.",
    "highlight": false
  },
  {
    "id": "cbex_sharpshooter",
    "name": "Crossbow Expert + Sharpshooter",
    "icon": "🏹🎯",
    "tags": [
      "daño",
      "ranged",
      "DPS"
    ],
    "what": "El rey del daño a distancia. Acción: 2 ataques con ballesta de mano (+10). BA: 1 ataque más (+10). 3 ataques con +10 cada uno sin desventaja en melee.",
    "how": "En nivel 5 Fighter: Ataque (2) + BA (1) = 3 ataques × (1d6+DEX+10). Con Action Surge: 5 ataques en una ronda. Sin rival para DPS a distancia.",
    "highlight": true
  },
  {
    "id": "pam_sentinel",
    "name": "PAM + Sentinel",
    "icon": "🪖🛡️",
    "tags": [
      "control",
      "tanque",
      "zona"
    ],
    "what": "Control de zona absoluto. PAM: AoO cuando un enemigo entra en 10ft. Sentinel: ese AoO reduce velocidad a 0. Resultado: nadie puede acercarse a vos (ni a tus aliados).",
    "how": "Posicionarte entre los enemigos y los squishies. Cuando intenten acercarse: AoO + PAM = velocidad 0, se quedan en 10ft. Próximo turno: otro AoO si intentan salir (Sentinel). Prisión.",
    "highlight": true
  },
  {
    "id": "warcaster_sentinel",
    "name": "War Caster + Sentinel",
    "icon": "✨🛡️",
    "tags": [
      "control",
      "spellcaster",
      "melee"
    ],
    "what": "Cuando un enemigo trata de alejarse (o ataca a un aliado adyacente): tu reacción ahora puede lanzar un hechizo en lugar de un ataque básico.",
    "how": "Thunderwave/Hold Person/Shocking Grasp como AoO. Shocking Grasp impide la reacción del enemigo. Hold Person paraliza. Mejor que cualquier ataque de oportunidad.",
    "highlight": false
  },
  {
    "id": "smite_gwm",
    "name": "Paladin + GWM",
    "icon": "🛡️🪓",
    "tags": [
      "daño",
      "paladin",
      "burst"
    ],
    "what": "Divine Smite se activa DESPUÉS de ver el dado de ataque. Si el ataque impacta con GWM: agregás el Smite. Si es crítico: dobla los dados de Smite + BA de GWM.",
    "how": "Ej: Ataque impacta → GWM +10 → Smite (2d8+) = ~30 daño en 1 hit. En crítico: (4d8 de smite + 2d6 de espada) × 2 + 10 = entre 40-80 daño. La explosión del Paladín.",
    "highlight": true
  },
  {
    "id": "lucky_champion",
    "name": "Lucky + Champion",
    "icon": "🍀⚔️",
    "tags": [
      "critico",
      "fighter"
    ],
    "what": "Champion crita en 19-20 (nivel 3) o 18-20 (nivel 15). Lucky te da 3 dados de reroll por descanso largo. Tirás de nuevo para buscar ese 18-20.",
    "how": "Tirás el dado de ataque → no es crítico → Lucky → tirás de nuevo buscando el rango ampliado. Con ventaja (2 dados) la probabilidad de crit sube enormemente.",
    "highlight": false
  },
  {
    "id": "mobile_rogue",
    "name": "Mobile + Rogue",
    "icon": "💨🗡️",
    "tags": [
      "movilidad",
      "rogue",
      "sneak"
    ],
    "what": "Rogue + Mobile = hit-and-run perfecto. Atacás (con SA), y Mobile garantiza que no provoca AoO. No necesitás Cunning Action: Disengage, liberando la BA para otra cosa.",
    "how": "Atacá → SA → alejate libremente sin Disengage. BA queda libre para Cunning Action: Hide para tener ventaja en el próximo ataque, o Bonus Attack si tenés two-weapon fighting.",
    "highlight": false
  },
  {
    "id": "shield_master_attack",
    "name": "Shield Master + Ataque",
    "icon": "🛡🤜",
    "tags": [
      "control",
      "shove"
    ],
    "what": "Después de la Acción de Ataque: BA para empujar (prono o 5ft). Empujar prono a un enemigo adyacente da ventaja a todos los ataques cuerpo a cuerpo del grupo hasta que se levante.",
    "how": "Ataque → derribás prono → aliados tienen ventaja en melee. Combinado con Sentinel: prono + no puede moverse. Efectivo con cualquier clase que tenga escudo y Extra Attack.",
    "highlight": false
  },
  {
    "id": "resilient_warcaster",
    "name": "Resilient CON + War Caster",
    "icon": "💪✨",
    "tags": [
      "concentración",
      "spellcaster"
    ],
    "what": "Doble protección de concentración. Resilient CON: proficiencia en CON saves. War Caster: ventaja adicional. Resultado: casi imposible perder concentración.",
    "how": "Con CON +2 y proficiencia: bono de ~+6 al save. Con ventaja: tirás 2 dados y elegís el mejor. La mayoría de golpes que hacen DC 10-15 ni te inmutan.",
    "highlight": false
  },
  {
    "id": "inspiring_bard",
    "name": "Inspiring Leader + Bard/Paladin",
    "icon": "📣🎸",
    "tags": [
      "support",
      "prebuff"
    ],
    "what": "Bard o Paladin tiene CHA alto + Inspiring Leader = HP temporales masivos para todo el grupo ANTES de cada combate.",
    "how": "CHA +4 + nivel 6 = 10 HP temporales a 6 aliados. Son 60 HP extra para el grupo. Combinado con Bardic Inspiration y Aura of Protection, el grupo entero es mucho más resistente.",
    "highlight": false
  }
];

export const UNIVERSAL_RULES: RuleBlock[] = [
  {
    "title": "Tu turno de combate",
    "items": [
      {
        "label": "MOVIMIENTO",
        "desc": "Hasta tu velocidad. Podés dividirlo antes y después de tu acción.",
        "color": "#3498db"
      },
      {
        "label": "ACCIÓN",
        "desc": "Atacar, lanzar hechizo, Dash, Dodge, Help, Hide, Ready...",
        "color": "#e74c3c"
      },
      {
        "label": "ACCIÓN ADICIONAL",
        "desc": "Solo si una habilidad/hechizo te la otorga. No es intercambiable con la acción.",
        "color": "#f39c12"
      },
      {
        "label": "REACCIÓN",
        "desc": "1 vez por ronda (incluso fuera de tu turno). Se recupera al inicio de tu turno.",
        "color": "#9b59b6"
      },
      {
        "label": "INTERACCIÓN GRATIS",
        "desc": "1 vez por turno: sacar/guardar arma, abrir puerta, recoger objeto. ¡La gente lo olvida!",
        "color": "#27ae60"
      }
    ]
  },
  {
    "title": "Lo que la gente más olvida",
    "items": [
      {
        "label": "Ayudar (Help)",
        "desc": "Acción para dar ventaja a aliado en ataque vs enemigo adyacente a vos."
      },
      {
        "label": "Empujar/Agarre",
        "desc": "STR(Athletics) vs STR(Athletics)/DEX(Acrobatics). Empujás 5ft o agarrás."
      },
      {
        "label": "Cobertura media",
        "desc": "+2 CA y saves DEX. Cualquier obstáculo parcial."
      },
      {
        "label": "Cobertura total",
        "desc": "+5 CA. No podés ser target directo."
      },
      {
        "label": "Percepción Pasiva",
        "desc": "10 + WIS mod + proficiencia. Siempre activa."
      },
      {
        "label": "Concentración",
        "desc": "Si tomás daño: CON save DC 10 o mitad del daño. Perder concentración = perder el hechizo."
      }
    ]
  }
];
