module.exports = function healerToolbox(dispatch) {
    const command = dispatch.command;
    const settings = dispatch.settings;
    const constants = require('./constants');

    // MARK: Variables

    let enabled = true;
	
	let isUpdatingMarkers = false;

    let markerDelayTimeout = null;

	let realMarkers = [];
    let markers = [];
    let partyMembers = [];

    let effectsCache = new Map();
    let warningsTimeout = new Map();
    let pendingWarnings = new Map();
    let cooldownWarnings = new Map();

    let currentPlayerId = -1;
    let currentGameId = -1;
    let currentClass = -1;
    let currentTemplate = -1;
    let currentName = null;

    // MARK: Commands

    command.add(['healertoolbox', 'htoolbox', 'htb', 'ht'], () => {
        if (isHealer() == false) {
            command.message('Module is only available for Healer classes.');
            return;
        }

        enabled = !enabled;

        command.message(settings.enable ? 'Healer Toolbox enabled' : 'Healer Toolbox disabled');

        clearData();

        if (enabled)
            command.message('Changes will take effect upon (re-)creating the party');
    })

    // MARK: Events

    dispatch.hook('S_LOGIN', constants.Protocols.S_LOGIN, (event) => {
        partyMembers.length = 0;
        markers.length = 0;
        currentPlayerId = event.playerId;
        currentGameId = event.gameId;
        currentTemplate = event.templateId;
        currentClass = (event.templateId - 10101) % 100;

        removeEffect(currentGameId, getAutoRescurrectEffect(settings.autoRecurrectEffect));

        enabled = isHealer();
    })

    dispatch.hook('S_PARTY_MEMBER_LIST', constants.Protocols.S_PARTY_MEMBER_LIST, (event) => {
        if (enabled == false)
            return;

        partyMembers = event.members.map((member) => {
			return {
				name: member.name,
				alive: true,
				currentHp: -1,
				maxHp: -1,
				currentMp: -1,
				maxMp: -1,
				hasDefensiveStance: false,
				class: member.class,
				leader: (event.leaderPlayerId == member.playerId),
				playerId: member.playerId,
				gameId: member.gameId
			}
		})
    })
	
	dispatch.hook('S_PARTY_MARKER', 1, {order: 100, filter: {fake: null}}, ({markers}) => {
		if (isUpdatingMarkers)
			return;
		
		realMarkers = markers;
    })

    dispatch.hook('S_PARTY_MEMBER_CHANGE_HP', constants.Protocols.S_PARTY_MEMBER_CHANGE_HP, (event) => {
        if (enabled == false)
            return;

        let member = findPartyMemberByPlayerId(event.playerId);

		if (member == undefined)
			return;

		let oldCurrentHp = member.currentHp;

		member.maxHp = parseInt(event.maxHp);
		member.currentHp = parseInt(event.currentHp);

		healthChanged(member, oldCurrentHp, member.currentHp, member.maxHp);
    })

    dispatch.hook('S_PARTY_MEMBER_CHANGE_MP', constants.Protocols.S_PARTY_MEMBER_CHANGE_MP, (event) => {
        if (enabled == false)
            return;
		
		let member = findPartyMemberByPlayerId(event.playerId);

		if (member == undefined)
			return;

		let oldCurrentMp = member.currentMp;

		member.maxMp = event.maxMp;
		member.currentMp = event.currentMp;

		manaChanged(member, oldCurrentMp, member.currentMp, member.maxMp);
    })

    dispatch.hook('S_CHANGE_PARTY_MANAGER', constants.Protocols.S_CHANGE_PARTY_MANAGER, ({ playerId }) => {
        if (enabled == false)
            return;

        for (const partyMember of partyMembers) {
            partyMember.leader = (partyMember.playerId == playerId);
        }
    })

    dispatch.hook('S_SPAWN_ME', constants.Protocols.S_SPAWN_ME, (event) => {
        updateAlive(event.gameId, event.alive);
    })
	
    dispatch.hook('S_SPAWN_USER', constants.Protocols.S_SPAWN_USER, (event) => {
        updateAlive(event.gameId, event.alive);
    })
	
    dispatch.hook('S_CREATURE_LIFE', constants.Protocols.S_CREATURE_LIFE, (event) => {
        updateAlive(event.gameId, event.alive);
    })

    dispatch.hook('S_LEAVE_PARTY_MEMBER', constants.Protocols.S_LEAVE_PARTY_MEMBER, ({ playerId }) => {
        if (enabled == false)
            return;
		
		let member = findPartyMemberByPlayerId(playerId);
		
		if (member == null)
			return;
		
        removeEffect(member.gameId, getAutoRescurrectEffect(settings.autoRecurrectEffect));
		
		removePartyMember(playerId);
		
		updateMarkers();
    })

    dispatch.hook('S_LEAVE_PARTY', constants.Protocols.S_LEAVE_PARTY, () => {
        if (enabled == false)
            return;

        partyMembers.length = 0;
		markers.length = 0;

		updateMarkers();

        removeEffect(currentGameId, getAutoRescurrectEffect(settings.autoRecurrectEffect));
    })

    dispatch.hook('S_ABNORMALITY_BEGIN', constants.Protocols.S_ABNORMALITY_BEGIN, (event) => {
        return updateEffect(event.target, event.id, false);
    })
	
    dispatch.hook('S_ABNORMALITY_REFRESH', constants.Protocols.S_ABNORMALITY_REFRESH, (event) => {
        return updateEffect(event.target, event.id, false);
    })
	
    dispatch.hook('S_ABNORMALITY_END', constants.Protocols.S_ABNORMALITY_END, (event) => {
        return updateEffect(event.target, event.id, true);
    })

    // MARK: Functions

    function healthChanged(member, from, to, max) {
        if (settings.healthWarning == false)
            return;

		if (to == 0)
			return;

		if (from == 0)
			return;

		let percentage = (to / max) * 100;

		let thresholdPercentage = (member.playerId == currentPlayerId ? settings.healthPercentage : settings.otherHealthPercentage);

		if (percentage > thresholdPercentage) {
			removeWarning(constants.WarningTypes.health, member);
		} else {
			addWarning(constants.WarningTypes.health, member);
		}
    }

    function manaChanged(member, from, to, max) {
        if (settings.manaWarning == false)
            return;

		if (from == 0)
			return;

		let percentage = (to / max) * 100;

		let thresholdPercentage = (member.playerId == currentPlayerId ? settings.manaPercentage : settings.otherManaPercentage);

		if (percentage > thresholdPercentage) {
			removeWarning(constants.WarningTypes.mana, member);
		} else {
			addWarning(constants.WarningTypes.mana, member);
		}
    }

    function updateEffect(gameId, effectId, isFinished) {
        if (enabled == false)
            return;

        effectApplied(gameId, effectId, isFinished);

        lookupEffect(gameId, effectId, isFinished);

        updateDefensiveStance(gameId, effectId, isFinished);

        return updateAutoRescurrectEffect(gameId, effectId, isFinished);
    }

    function lookupEffect(gameId, effectId, isFinished) {
        if (effectsCache.has(effectId))
            return;

        let member = findPartyMemberByGameId(gameId);

        dispatch.queryData('/Abnormality/Abnormal@id=?/', [effectId]).then(result => {
			if (result == null || result.attributes == null)
				return;
			
            if (!effectsCache.has(effectId)) {
				let effectData = { isBuff: result.attributes.isBuff, type: result.attributes.property };
				
                effectsCache.set(effectId, effectData)
			}

			effectApplied(gameId, effectId, isFinished);
        })
    }

    function effectApplied(gameId, effectId, isFinished) {
        let effect = effectsCache.get(effectId);

        if (effect == null)
            return;

		if (effect.isBuff == true)
			return;

		let member = findPartyMemberByGameId(gameId);

		if (member == null)
			return;

		let type = null;

		switch (effect.type) {
		case constants.AbnormalityProperties.stun:
			type = constants.WarningTypes.stun;
			break;
		case constants.AbnormalityProperties.bleed:
			type = constants.WarningTypes.bleed;
			break;
		default:
			break;
		}

		if (type == null)
			return;

		if (isFinished == false) {
			addWarning(type, member);
		} else {
			removeWarning(type, member);
		}
    }

    function updateDefensiveStance(gameId, effectId, isFinished) {
        if (constants.DefensiveStances.includes(effectId) == false)
            return;
		
		let member = findPartyMemberByGameId(gameId);

		if (member == undefined)
			return;

		member.hasDefensiveStance = isFinished == false;
    }

    function updateAutoRescurrectEffect(gameId, effectId, isFinished) {
        if (constants.AutoRescurrect.includes(effectId) == false)
            return;

		let member = findPartyMemberByGameId(gameId);

		if (member == null)
			return;

		if (effectId == getAutoRescurrectEffect(settings.autoRecurrectEffect))
			return false;

		if (isFinished) {
			removeEffect(gameId, getAutoRescurrectEffect(settings.autoRecurrectEffect));
		} else {
			applyEffect(gameId, getAutoRescurrectEffect(settings.autoRecurrectEffect));
		}
    }

    function updateAlive(gameId, alive) {
        if (enabled == false)
            return;
		
		let member = findPartyMemberByGameId(gameId);

		if (member == undefined)
			return;

		if (member.alive == alive)
			return;

		member.alive = alive;

		if (currentGameId == gameId)
			return;

		if (alive == false) {
			[constants.WarningTypes.mana, constants.WarningTypes.health, constants.WarningTypes.stun, constants.WarningTypes.bleed].forEach((type) => removeWarning(gameId, type));

			if (settings.deathWarning == true) {
				addWarning(constants.WarningTypes.death, member);
			}

			if (settings.deathMarkers == true) {
				markers.push({
					color: getMarkerColor(member),
					target: member.gameId
				});
			}
		} else {
			if (settings.deathWarning == true) {
				removeWarning(constants.WarningTypes.death, member);
			}

			if (settings.deathMarkers == true) {
				markers = markers.filter((marker) => {
					return marker.target != member.gameId;
				})
			}
		}

		if (settings.deathMarkers == true) {
			clearTimeout(markerDelayTimeout);
			markerDelayTimeout = setTimeout(updateMarkers, 500);
		}
    }

    function updateMarkers() {
		isUpdatingMarkers = true;
		
		let partyMarkers = realMarkers.length ? realMarkers.concat(markers) : markers;
		
        dispatch.send('S_PARTY_MARKER', constants.Protocols.S_PARTY_MARKER, {
            markers: partyMarkers
        });
		
		isUpdatingMarkers = false;
    }

    function applyEffect(gameId, effectId) {
        dispatch.send('S_ABNORMALITY_BEGIN', constants.Protocols.S_ABNORMALITY_BEGIN, {
            target: gameId,
            source: currentGameId,
            id: effectId,
            duration: 0,
            stacks: 1,
        });
    }

    function removeEffect(gameId, effectId) {
        dispatch.send('S_ABNORMALITY_END', constants.Protocols.S_ABNORMALITY_END, {
            target: gameId,
            id: effectId
        });
    }

    function sendAnnouncement(message) {
        dispatch.send('S_DUNGEON_EVENT_MESSAGE', constants.Protocols.S_DUNGEON_EVENT_MESSAGE, {
            message: message,
            type: 48,
            chat: false,
            channel: 0
        });
    }

    function playSound(soundId) {
        dispatch.send('S_PLAY_SOUND', constants.Protocols.S_PLAY_SOUND, {
            SoundID: soundId
        });
    }

    function clearData() {
        partyMembers.length = 0;
		markers.length = 0;

		warningsTimeout.values().forEach((timeout) => clearTimeout(markerDelayTimeout));

		effectsCache.clear();
		pendingWarnings.clear();
		warningsTimeout.clear();
		cooldownWarnings.clear();

		clearTimeout(markerDelayTimeout);
		markerDelayTimeout = null;

		removeEffect(currentGameId, getAutoRescurrectEffect(settings.autoRecurrectEffect));

		updateMarkers();
    }

    function addWarning(type, member) {
        let cooldowns = cooldownWarnings.get(type);
		let name = member.name;

		if (cooldowns != undefined && cooldowns.includes(name))
			return;

		let warnings = (pendingWarnings.get(type) || []);

		if (warnings.includes(name))
			return;

		warnings.push(name);

		pendingWarnings.set(type, warnings);

		startWarningTimeout(type);
    }

    function removeWarning(type, member) {
        let cooldowns = cooldownWarnings.get(type);
		let name = member.name;

		if (cooldowns != undefined) {
			cooldowns = cooldowns.filter((otherName) => {
				return name != otherName;
			})

			if (cooldowns.length == 0) {
				cooldownWarnings.delete(type);
			} else {
				cooldownWarnings.set(type, cooldowns);
			}
		}

		let warnings = pendingWarnings.get(type);

		if (warnings == undefined || warnings.includes(name) == false)
			return;

		warnings = warnings.filter((otherName) => {
			return otherName != name;
		})

		if (warnings.length == 0) {
			pendingWarnings.delete(type);

			stopWarningTimeout(type);
		} else {
			pendingWarnings.set(type, warnings);
		}
    }

    function startWarningTimeout(type) {
        if (warningsTimeout.has(type))
            return;

        warningsTimeout.set(type, setTimeout(showWarnings, 400, type));
    }

    function stopWarningTimeout(type) {
        if (warningsTimeout.has(type) == false)
            return;

        clearTimeout(warningsTimeout.get(type));

        warningsTimeout.delete(type);
    }

    function showWarnings(type) {
        let names = pendingWarnings.get(type);

		if (names == undefined)
			return;

		let message = getMessage(type, names);
		let skillId = getSkillId(type);

		if (message == null || skillId == null)
			return;

		let cooldowns = (cooldownWarnings.get(type) || []);
		
		names.forEach((name) => {
			cooldowns.push(name);
		})

		cooldownWarnings.set(type, cooldowns);

		warningsTimeout.delete(type);
		pendingWarnings.delete(type);
		
		let textColor = getTextColor(settings.warningTextColor);

		let announcement = `<img src="img://skill__0__${currentTemplate}__${skillId}" width="48" height="48" vspace="-20"/><font size="24" color="#${textColor}">&nbsp;${message}</font>`;
		let soundType = getWarningSoundType(type);

		playSound(soundType);
		sendAnnouncement(announcement);
    }

    function getMessage(type, names) {
		let textColor = getTextColor(settings.warningPlayersTextColor);
        let namesString = `<font color="#${textColor}">${names.join(", ")}</font>`;

		switch (type) {
		case constants.WarningTypes.health:
			return `Heal ${namesString}`;
		case constants.WarningTypes.mana:
			return `Mana ${namesString}`;
		case constants.WarningTypes.death:
			return `Resurrect ${namesString}`;
		case constants.WarningTypes.stun:
			return `Cleanse ${namesString} (Stunned)`;
		case constants.WarningTypes.bleed:
			return `Cleanse ${namesString} (Bleeding)`;
		default:
			return null;
		}
    }

    function getSkillId(type) {
        switch (currentClass) {
        case constants.Classes.mystic:
            switch (type) {
            case constants.WarningTypes.health:
                return constants.Skills.titanicFavor;
            case constants.WarningTypes.mana:
                return constants.Skills.arunicRelease;
            case constants.WarningTypes.death:
                return constants.Skills.mysticRescurrect;
            case constants.WarningTypes.stun:
            case constants.WarningTypes.bleed:
                return constants.Skills.arunsCleansingTouch;
            default:
                return null;
            }
        case constants.Classes.priest:
            switch (type) {
            case constants.WarningTypes.health:
                return constants.Skills.focusHeal;
            case constants.WarningTypes.mana:
                return constants.Skills.divineCharge;
            case constants.WarningTypes.death:
                return constants.Skills.priestRescurrect;
            case constants.WarningTypes.stun:
            case constants.WarningTypes.bleed:
                return constants.Skills.purifyingCircle;
            default:
                return null;
            }
        default:
            return null;
        }
    }

    function getMarkerColor(member) {
        switch (member.class) {
        case constants.Classes.lancer:
        case constants.Classes.brawler:
            return constants.MarkerColors.red;
        case constants.Classes.priest:
        case constants.Classes.mystic:
            return constants.MarkerColors.blue;
        case constants.Classes.warrior:
        case constants.Classes.berserker:
            return member.hasDefensiveStance ? constants.MarkerColors.red : constants.MarkerColors.yellow;
        default:
            return constants.MarkerColors.yellow;
        }
    }

    function getWarningSoundType(type) {
        switch (type) {
        case constants.WarningTypes.health:
            return getSoundType(settings.healthSound);
        case constants.WarningTypes.mana:
            return getSoundType(settings.manaSound);
        case constants.WarningTypes.stun:
        case constants.WarningTypes.bleed:
            return getSoundType(settings.cleanseSound);
        case constants.WarningTypes.death:
            return getSoundType(settings.deathSound);
        default:
            return -1;
        }
    }

    function getSoundType(name) {
        switch (name) {
        case 'notice':
            return constants.SoundTypes.notice;
        case 'cling1':
            return constants.SoundTypes.cling1;
        case 'cling2':
            return constants.SoundTypes.cling2;
        case 'whisper':
            return constants.SoundTypes.whisper;
        case 'bell1':
            return constants.SoundTypes.bell1;
        case 'bell2':
            return constants.SoundTypes.bell2;
        default:
            return -1;
        }
    }
	
	function getTextColor(name) {
		switch (name) {
        case 'brightOrange':
            return constants.TextColors.brightOrange;
        case 'white':
           return constants.TextColors.white;
	   case 'black':
           return constants.TextColors.black;
	   case 'silver':
           return constants.TextColors.silver;
	   case 'gray':
           return constants.TextColors.gray;
	   case 'red':
           return constants.TextColors.red;
	   case 'maroon':
           return constants.TextColors.maroon;
	   case 'olive':
           return constants.TextColors.olive;
	   case 'lime':
           return constants.TextColors.lime;
	   case 'green':
           return constants.TextColors.green;
	   case 'aqua':
           return constants.TextColors.aqua;
	   case 'teal':
           return constants.TextColors.teal;
	   case 'blue':
           return constants.TextColors.blue;
	   case 'navy':
           return constants.TextColors.navy;
	   case 'fuchia':
           return constants.TextColors.fuchia;
	   case 'purple':
           return constants.TextColors.purple;
        default:
			if (isHexColor(name)) {
				return name;
			}
			  
			return constants.TextColors.white;
        }
	}
	
	function getAutoRescurrectEffect(name) {
		switch (name) {
        case 'emergencyBarrier':
			return constants.VisualEffects.emergencyBarrier
		case 'apexUrgency':
			return constants.VisualEffects.apexUrgency
		default:
			return -1;
		}
	}
	
	function isHexColor(hex) {
		return typeof hex === 'string'
			&& hex.length === 6
			&& !isNaN(Number('0x' + hex))
	}

    function isHealer() {
        return currentClass == constants.Classes.priest || currentClass == constants.Classes.mystic;
    }
	
	function findPartyMemberByPlayerId(playerId) {
		return partyMembers.find((member) => {
            return member.playerId == playerId;
        });
	}
	
	function findPartyMemberByGameId(gameId) {
		return partyMembers.find((member) => {
            return member.gameId == gameId;
        });
	}
	
	function removePartyMember(playerId) {
		partyMembers = partyMembers.filter((member) => {
			return member.playerId != playerId;
		});
	}
}
