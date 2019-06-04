const commandUtils = require( './command-utils' );
const gateway = require( './gateway' );

const help = function() {
    let help = `
Usage: airlocal cache clear

Clears npm, wp-cli, and Air Snapshots caches
`;
    console.log( help );
    process.exit();
};

const clear = async function() {
    await gateway.removeCacheVolume();
    await gateway.ensureCacheExists();

    console.log( "Cache Cleared" );
};

const command = async function() {
    switch( commandUtils.subcommand() ) {
        case 'clear':
            await clear();
            break;
        default:
            help();
            break;
    }
};

module.exports = { command, clear };
