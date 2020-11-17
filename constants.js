const PROTOCOLS = {
    S_LOGIN: 14,
    S_PARTY_MEMBER_LIST: 7,
    S_PARTY_MEMBER_CHANGE_HP: 4,
    S_PARTY_MEMBER_CHANGE_MP: 2,
    S_CHANGE_PARTY_MANAGER: 2,
    S_SPAWN_ME: 3,
    S_SPAWN_USER: 16,
    S_CREATURE_LIFE: 3,
    S_LEAVE_PARTY_MEMBER: 2,
    S_LEAVE_PARTY: 'raw',
    S_PARTY_MEMBER_INTERVAL_POS_UPDATE: 3,
    S_ABNORMALITY_BEGIN: 4,
    S_ABNORMALITY_REFRESH: 2,
    S_ABNORMALITY_END: 1,
    S_PARTY_MARKER: 1,
    S_DUNGEON_EVENT_MESSAGE: 2,
    S_PLAY_SOUND: 1,
    C_PLAYER_LOCATION: 5
}

const ABNORMALITY_PROPERTIES = {
    stun: 3,
    bleed: 2
}

const WARNING_TYPES = {
    health: 0,
    mana: 1,
    stun: 2,
    bleed: 3,
    death: 4
}

const SOUND_TYPES = {
    notice: 2089,
    cling1: 2094,
    cling2: 4007,
    whisper: 2001,
    bell1: 2029,
    bell2: 3028
}

const MARKER_COLORS = {
    red: 0,
    yellow: 1,
    blue: 2
}

const CLASSES = {
    warrior: 0,
    lancer: 1,
    slayer: 2,
    berserker: 3,
    sorcerer: 4,
    archer: 5,
    priest: 6,
    mystic: 7,
    reaper: 8,
    gunner: 9,
    brawler: 10,
    ninja: 11,
    valkyrie: 12
}

const SKILLS = {
    mysticRescurrect: 100100,
    priestRescurrect: 120100,
    titanicFavor: 50100,
    arunicRelease: 470100,
    arunsCleansingTouch: 90100,
    focusHeal: 190100,
    divineCharge: 280200,
    purifyingCircle: 100100
}

const TEXT_COLORS = {
    brightOrange: "FBA504",
    white: "FFFFFF",
	black: "000000",
	silver: "C0C0C0",
	gray: "808080",
	red: "FF0000",
	maroon: "800000",
	olive: "808000",
	lime: "00FF00",
	green: "008000",
	aqua: "00FFFF",
	teal: "008080",
	blue: "0000FF",
	navy: "000080",
	fuchia: "FF00FF",
	purple: "800080"
}

const VISUAL_EFFECTS = {
	emergencyBarrier: 10152110,
	apexUrgency: 90520
}

const AUTO_RESCURRECT = [700100, 801700, 4951, 4954];

const DEFENSIVE_STANCES = [100203, 100202, 100201, 100200, 401400, 401402, 401404];

module.exports = {
    AutoRescurrect: AUTO_RESCURRECT,
    TextColors: TEXT_COLORS,
    Classes: CLASSES,
    MarkerColors: MARKER_COLORS,
    SoundTypes: SOUND_TYPES,
    WarningTypes: WARNING_TYPES,
    AbnormalityProperties: ABNORMALITY_PROPERTIES,
    Skills: SKILLS,
    DefensiveStances: DEFENSIVE_STANCES,
    Protocols: PROTOCOLS,
	VisualEffects: VISUAL_EFFECTS
};
