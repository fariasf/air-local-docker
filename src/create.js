const commandUtils = require('./command-utils')
const path = require('path')
const fs = require('fs-extra')
const yaml = require('write-yaml')
const inquirer = require('inquirer')
const promptValidators = require('./prompt-validators')
const database = require('./database')
const gateway = require('./gateway')
const environment = require('./environment.js')
const wordpress = require('./wordpress')
const envUtils = require('./env-utils')
const sudo = require('sudo-prompt')
const config = require('./configure')
const chalk = require('chalk')

const help = function () {
  let help = `
Usage: airlocal create

Creates a new docker environment interactively.
`
  console.log(help)
  process.exit()
}

const createEnv = async function () {
  var baseConfig = {
    'version': '3',
    'services': {
      'memcached': {
        'image': 'memcached:latest'
      },
      'nginx': {
        'image': 'nginx:latest',
        'expose': [
          '80',
          '443'
        ],
        'volumes': [
          './wordpress:/var/www/html:cached'
        ],
        'depends_on': [
          'phpfpm',
          'memcacheadmin'
        ],
        'networks': [
          'default',
          'airlocaldocker'
        ],
        'environment': {
          'CERT_NAME': 'localhost',
          'HTTPS_METHOD': 'noredirect'
        }
      },
      'memcacheadmin': {
        'image': 'hitwe/phpmemcachedadmin',
        'expose': [
          '80'
        ],
        'depends_on': [
          'memcached'
        ]
      }
    }
  }

  var networkConfig = {
    'networks': {
      'airlocaldocker': {
        'external': {
          'name': 'airlocaldocker'
        }
      }
    }
  }

  var volumeConfig = {
    'volumes': {}
  }
  volumeConfig.volumes[ envUtils.cacheVolume ] = {
    'external': {
      'name': `${envUtils.cacheVolume}`
    }
  }

  let questions = [
    {
      name: 'hostname',
      type: 'input',
      message: 'What is the primary hostname for your site? (Ex: docker.test)',
      validate: promptValidators.validateNotEmpty,
      filter: promptValidators.parseHostname
    },
    {
      name: 'addMoreHosts',
      type: 'confirm',
      message: 'Are there additional domains the site should respond to?',
      default: false
    },
    {
      name: 'extraHosts',
      type: 'input',
      message: 'Enter additional hostnames separated by spaces (Ex: docker1.test docker2.test)',
      filter: async function (value) {
        let answers = value.split(' ').map(function (value) {
          return value.trim()
        }).filter(function (value) {
          return value.length > 0
        }).map(promptValidators.parseHostname)

        return answers
      },
      when: function (answers) {
        return answers.addMoreHosts === true
      }
    },
    {
      name: 'mediaProxy',
      type: 'confirm',
      message: 'Do you want to set a proxy for media assets? (i.e. Serving /uploads/ directory assets from a production site)',
      default: false
    },
    {
      name: 'proxy',
      type: 'input',
      message: 'Proxy URL',
      default: function (answers) {
        return envUtils.createDefaultProxy(answers.hostname)
      },
      validate: promptValidators.validateNotEmpty,
      filter: promptValidators.parseProxyUrl,
      when: function (answers) {
        return answers.mediaProxy === true
      }
    },
    {
      name: 'phpVersion',
      type: 'list',
      message: 'What version of PHP would you like to use?',
      choices: [ '7.3', '7.2', '7.1', '7.0', '5.6' ],
      default: '7.3'
    },
    {
      name: 'elasticsearch',
      type: 'confirm',
      message: 'Do you need Elasticsearch'
    },
    {
      name: 'wordpress',
      type: 'confirm',
      message: 'Do you want to install WordPress?'
    },
    {
      name: 'wordpressType',
      type: 'list',
      message: 'Select a WordPress installation type:',
      choices: [
        { name: 'Single Site', value: 'single' },
        { name: 'Subdirectory Multisite', value: 'subdirectory' },
        { name: 'Subdomain Multisite', value: 'subdomain' },
        { name: 'Core Development Version', value: 'dev' }
      ],
      default: 'single',
      when: function (answers) {
        return answers.wordpress === true
      }
    },
    {
      name: 'emptyContent',
      type: 'confirm',
      message: 'Do you want to remove the default content?',
      when: function (answers) {
        return answers.wordpress === true
      }
    },
    {
      name: 'title',
      type: 'input',
      message: 'Site Name',
      default: function (answers) {
        return answers.hostname
      },
      validate: promptValidators.validateNotEmpty,
      when: function (answers) {
        return answers.wordpress === true
      }
    },
    {
      name: 'username',
      type: 'input',
      message: 'Admin Username',
      default: 'admin',
      validate: promptValidators.validateNotEmpty,
      when: function (answers) {
        return answers.wordpress === true
      }
    },
    {
      name: 'password',
      type: 'input',
      message: 'Admin Password',
      default: 'password',
      validate: promptValidators.validateNotEmpty,
      when: function (answers) {
        return answers.wordpress === true
      }
    },
    {
      name: 'email',
      type: 'input',
      message: 'Admin Email',
      default: 'admin@example.com',
      validate: promptValidators.validateNotEmpty,
      when: function (answers) {
        return answers.wordpress === true
      }
    }
  ]

  let answers = await inquirer.prompt(questions)

  // Folder name inside of /sites/ for this site
  let envHost = answers.hostname
  let envSlug = envUtils.envSlug(envHost)
  let envPath = await envUtils.envPath(envHost)

  // Default nginx configuration file
  let nginxConfig = 'default.conf'

  if (await fs.exists(envPath) === true) {
    console.log()
    console.error(`Error: ${envHost} environment already exists. To recreate the environment, please delete it first by running \`airlocal delete ${envHost}\``)
    process.exit(1)
  }

  await gateway.startGlobal()

  let allHosts = [ answers.hostname ]
  let starHosts = []

  if (answers.addMoreHosts === true) {
    answers.extraHosts.forEach(function (host) {
      allHosts.push(host)
    })
  }

  // Remove duplicates
  allHosts = allHosts.filter(function (item, pos, self) {
    return self.indexOf(item) === pos
  })

  allHosts.forEach(function (host) {
    starHosts.push(`*.${host}`)
  })

  // Additional nginx config based on selections above
  baseConfig.services.nginx.environment.VIRTUAL_HOST = allHosts.concat(starHosts).join(',')

  baseConfig.services.phpfpm = {
    'image': '45air/phpfpm:' + answers.phpVersion,
    'volumes': [
      './wordpress:/var/www/html:cached',
      './config/php-fpm/php.ini:/usr/local/etc/php/php.ini:cached',
      './config/php-fpm/docker-php-ext-xdebug.ini:/usr/local/etc/php/conf.d/docker-php-ext-xdebug.ini:cached',
      `${envUtils.cacheVolume}:/var/www/.wp-cli/cache:cached`,
      '~/.ssh:/root/.ssh:cached'
    ],
    'depends_on': [
      'memcached'
    ],
    'networks': [
      'default',
      'airlocaldocker'
    ],
    'dns': [
      '10.0.0.2'
    ]
  }

  if (answers.wordpressType == 'dev') {
    baseConfig.services.phpfpm.volumes.push('./config/php-fpm/wp-cli.develop.yml:/var/www/.wp-cli/config.yml:cached')
    nginxConfig = 'develop.conf'
  } else {
    baseConfig.services.phpfpm.volumes.push('./config/php-fpm/wp-cli.local.yml:/var/www/.wp-cli/config.yml:cached')
  }

  // Map the nginx configuraiton file
  baseConfig.services.nginx.volumes.push('./config/nginx/' + nginxConfig + ':/etc/nginx/conf.d/default.conf:cached')

  if (answers.elasticsearch === true) {
    baseConfig.services.phpfpm.depends_on.push('elasticsearch')

    baseConfig.services.elasticsearch = {
      image: 'docker.elastic.co/elasticsearch/elasticsearch:5.6.5',
      'expose': [
        '9200'
      ],
      'volumes': [
        './config/elasticsearch/elasticsearch.yml:/usr/share/elasticsearch/config/elasticsearch.yml:cached',
        './config/elasticsearch/plugins:/usr/share/elasticsearch/plugins:cached',
        'elasticsearchData:/usr/share/elasticsearch/data:delegated'
      ],
      'environment': {
        ES_JAVA_OPTS: '-Xms750m -Xmx750m'
      }
    }

    volumeConfig.volumes.elasticsearchData = {}
  }

  // Create webroot/config
  console.log('Copying required files...')

  await fs.ensureDir(path.join(envPath, 'wordpress'))
  await fs.copy(path.join(envUtils.srcPath, 'config'), path.join(envPath, 'config'))

  // Write Docker Compose
  console.log('Generating docker-compose.yml file...')
  let dockerCompose = Object.assign(baseConfig, networkConfig, volumeConfig)
  await new Promise(resolve => {
    yaml(path.join(envPath, 'docker-compose.yml'), dockerCompose, { 'lineWidth': 500 }, function (err) {
      if (err) {
        console.log(err)
      }
      console.log('done')
      resolve()
    })
  })

  // Media proxy is selected
  if (answers.mediaProxy === true) {
    // Write the proxy to the config files
    console.log('Writing proxy configuration...')

    await new Promise(resolve => {
      fs.readFile(path.join(envPath, 'config', 'nginx', nginxConfig), 'utf8', function (err, curConfig) {
        if (err) {
          console.error(chalk.bold.yellow('Warning: ') + 'Failed to read nginx configuration file. Your media proxy has not been set. Error: ' + err)
          resolve()
          return
        }

        fs.writeFile(path.join(envPath, 'config', 'nginx', nginxConfig), config.createProxyConfig(answers.proxy, curConfig), 'utf8', function (err) {
          if (err) {
            console.error(chalk.bold.yellow('Warning: ') + 'Failed to write configuration file. Your media proxy has not been set. Error: ' + err)
            resolve()
          }
        })

        console.log('Proxy configured')
        resolve()
      })
    })
  }

  // Create database
  console.log('Creating database')
  await database.create(envSlug)
  await database.assignPrivs(envSlug)

  await environment.start(envSlug)

  if (answers.wordpress === true) {
    if (answers.wordpressType === 'dev') {
      await wordpress.downloadDevelop(envSlug)
    } else {
      await wordpress.download(envSlug)
    }

    await wordpress.configure(envSlug)

    await wordpress.install(envSlug, envHost, answers)

    await wordpress.setRewrites(envSlug)

    if (answers.emptyContent === true) {
      await wordpress.emptyContent(envSlug)
    }
  }

  if (await config.get('manageHosts') === true) {
    console.log('Adding entry to hosts file')
    let sudoOptions = {
      name: 'Air Local Docker'
    }
    await new Promise(resolve => {
      let hostsstring = allHosts.join(' ')
      sudo.exec(`airlocal-hosts add ${hostsstring}`, sudoOptions, function (error, stdout, stderr) {
        if (error) {
          console.error(chalk.bold.yellow('Warning: ') + `Something went wrong adding host file entries. You may need to add the /etc/hosts entries manually.`)
          resolve()
          return
        }

        console.log(stdout)
        resolve()
      })
    })
  }

  // Track things we might need to know later in order to clean up the environment
  let envConfig = {
    'envHosts': allHosts
  }
  await fs.writeJson(path.join(envPath, '.config.json'), envConfig)

  console.log()
  console.log('Successfully Created Site!')

  if (answers.wordpressType === 'subdomain') {
    console.log('Note: Subdomain multisites require any additional subdomains to be added manually to your hosts file!')
  }
}

const command = async function () {
  switch (commandUtils.subcommand()) {
    case 'help':
      help()
      break
    default:
      await createEnv()
      break
  }
}

module.exports = { command, help }
