import {expect, test} from '@oclif/test'
import * as fs from 'fs-extra'
import _ from 'lodash'
import {exec as execSync} from 'node:child_process'
import * as path from 'node:path'
import {promisify} from 'node:util'

import {gitSha} from '../../src/tarballs'
import {deleteFolder, developerSalesforceCom} from '../helpers/helper'

const exec = promisify(execSync)
const pjson = require('../../package.json')
const pjsonPath = require.resolve('../../package.json')
const originalPJSON = _.cloneDeep(pjson)
const target = [process.platform, process.arch].join('-')

const onlyLinux = process.platform === 'linux' ? test : test.skip()
const testRun = `test-${Math.random().toString().split('.')[1].slice(0, 4)}`

describe('publish:deb', () => {
  let bucket: string
  let basePrefix: string
  const root = path.join(__dirname, '../tmp/test/publish')

  beforeEach(async () => {
    pjson.version = `${pjson.version}-${testRun}`
    pjson.oclif.update.node.version = process.versions.node
    pjson.oclif.binAliases = ['oclif2']
    bucket = pjson.oclif.update.s3.bucket
    basePrefix = pjson.oclif.update.s3.folder
    await deleteFolder(bucket, `${basePrefix}/versions/${pjson.version}/`)
    await fs.writeJSON(pjsonPath, pjson, {spaces: 2})
    await fs.emptyDir(root)
  })
  afterEach(async () => {
    if (!process.env.PRESERVE_ARTIFACTS) {
      await deleteFolder(bucket, `${basePrefix}/versions/${pjson.version}/`)
    }

    await fs.writeJSON(pjsonPath, originalPJSON, {spaces: 2})
  })

  onlyLinux
    .command(['pack:deb'])
    .command(['upload:deb'])
    .it('publishes valid releases', async () => {
      const sha = await gitSha(process.cwd(), {short: true})
      await exec('cat test/release.key | sudo apt-key add -')
      await exec(
        `sudo sh -c 'echo "deb https://${developerSalesforceCom}/${basePrefix}/versions/${pjson.version}/${sha}/apt/ /" > /etc/apt/sources.list.d/oclif.list'`,
      )
      await exec('sudo apt-get update')
      await exec('sudo apt-get install -y oclif')
      await exec('oclif --version')
      // test the binAliases section
      const {stdout: oclif2} = await exec('oclif2 --version')
      expect(oclif2).to.contain(`oclif/${pjson.version} ${target} node-v${pjson.oclif.update.node.version}`)

      const {stdout: oclif} = await exec('oclif --version')
      expect(oclif).to.contain(`oclif/${pjson.version} ${target} node-v${pjson.oclif.update.node.version}`)
    })
})
