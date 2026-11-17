targetScope = 'subscription'

param location string = 'westus2'
param resourceGroupName string = 'rg-fiveforms-dev-c954'
param staticWebAppName string = 'swa-fiveforms-dev-c954'
param cosmosAccountName string = 'cosmos-fiveforms-dev-c954'
param environmentName string = 'fiveforms-dev-c954'
param sessionId string = 'c9549146-4297-4014-8c96-0d570bdb2a66'
param deployedBy string = 'azure-cli'
param createdAt string = '2026-11-17T00:43:13.3552922Z'

var tags = {
  'app-onboard-skill': 'true'
  'app-onboard-session-id': sessionId
  'created-at': createdAt
  environment: environmentName
  'deployed-by': deployedBy
}

resource group 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: tags
}

module game './game.bicep' = {
  name: 'fiveforms-resources'
  scope: group
  params: {
    location: location
    staticWebAppName: staticWebAppName
    cosmosAccountName: cosmosAccountName
    tags: tags
  }
}

output siteUrl string = game.outputs.siteUrl
