'use strict';

const defaultSettings = {
    "deathMarkers": true,
    "deathWarning": true,
    "healthWarning": true,
    "manaWarning": true,
    "healthPercentage": 65,
    "otherHealthPercentage": 45,
    "manaPercentage": 20,
    "otherManaPercentage": 25,
    "deathSound": 'notice',
    "deathSound": 'notice',
    "healthSound": 'notice',
    "manaSound": 'notice',
    "cleanseSound": 'notice',
	"warningTextColor": 'white',
	"warningPlayersTextColor": 'brightOrange'
};

function migrateSettings(fromVersion, toVersion, settings) {
    if (fromVersion === undefined) {
        return Object.assign(Object.assign({}, defaultSettings), settings);
    } else if (fromVersion === null) {
        return defaultSettings;
    } else {
        if (fromVersion + 1 < toVersion) {
            settings = migrateSettings(fromVersion, fromVersion + 1, settings);
            return migrateSettings(fromVersion + 1, toVersion, settings);
        }

        switch (toVersion) {}

        return settings;
    }
}

module.exports = migrateSettings;
