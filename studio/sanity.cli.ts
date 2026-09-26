import {defineCliConfig} from 'sanity/cli'

export default defineCliConfig({
  api: {
    projectId: '8xb5eyjm',
    dataset: 'production'
  },
  deployment: {
    /**
     * Enable auto-updates for studios.
     * Learn more at https://www.sanity.io/docs/studio/latest-version-of-sanity#k47faf43faf56
     */
    autoUpdates: true,
    // Deployed Studio app id — avoids the app-id prompt on future deploys.
    appId: 'h1w51threnfiq2b2rgee7ytz',
  },
})
