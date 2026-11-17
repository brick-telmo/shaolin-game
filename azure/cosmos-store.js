const PARTITION = 'game';
const LOBBY = 'lobby';
const RETRIES = 12;

export class CosmosStore {
  constructor(container) {
    this.container = container;
  }

  async read(id) {
    try {
      return (await this.container.item(id, PARTITION).read()).resource;
    } catch (error) {
      if (error.code === 404) return null;
      throw error;
    }
  }

  async lobby() {
    let lobby = await this.read(LOBBY);
    if (lobby) return lobby;
    try {
      await this.container.items.create({id: LOBBY, partition: PARTITION, players: []});
    } catch (error) {
      if (error.code !== 409) throw error;
    }
    lobby = await this.read(LOBBY);
    if (!lobby) throw new Error('Failed to initialize the matchmaking lobby.');
    return lobby;
  }

  async updateLobby(change) {
    for (let attempt = 0; attempt < RETRIES; attempt++) {
      const lobby = await this.lobby();
      const result = await change(lobby);
      if (!result.changed) return result.value;
      const operations = [{
        operationType: 'Replace', id: LOBBY, resourceBody: lobby, ifMatch: lobby._etag
      }];
      if (result.room) operations.push({
        operationType: 'Create', resourceBody: {...result.room, partition: PARTITION, ttl: 86400}
      });
      try {
        const response = await this.container.items.batch(operations, PARTITION);
        if (response.code === 412 || response.code === 409) continue;
        const results = response.result;
        if (!Array.isArray(results) || results.length !== operations.length)
          throw new Error('Lobby transaction returned an incomplete response.');
        const failure = results.find(operation => operation.statusCode >= 400 && operation.statusCode !== 424);
        if (results.every(operation => operation.statusCode >= 200 && operation.statusCode < 300) &&
            response.code >= 200 && response.code < 300) return result.value;
        if (failure?.statusCode === 412 || failure?.statusCode === 409) continue;
        throw new Error(`Lobby transaction failed (${failure?.statusCode ?? response.code}).`);
      } catch (error) {
        const code = error.code ?? error.cause?.code;
        if (code === 412 || code === 409) continue;
        throw error;
      }
    }
    throw new Error('Matchmaking is busy. Please retry.');
  }

  async updateRoom(id, change) {
    for (let attempt = 0; attempt < RETRIES; attempt++) {
      const room = await this.read(id);
      if (!room) return null;
      const {value, winner} = change(room);
      try {
        if (winner) {
          const account = await this.read(winner);
          if (!account || account.kind !== 'account') throw new Error('Winning account not found.');
          account.victories++;
          const operations = [
            {operationType: 'Replace', id, resourceBody: room, ifMatch: room._etag},
            {operationType: 'Replace', id: winner, resourceBody: account, ifMatch: account._etag}
          ];
          const response = await this.container.items.batch(operations, PARTITION);
          const results = response.result;
          if (response.code === 412 || response.code === 409 ||
              results?.some(result => result.statusCode === 412 || result.statusCode === 409)) continue;
          if (!Array.isArray(results) || results.length !== operations.length ||
              response.code < 200 || response.code >= 300 ||
              results.some(result => result.statusCode < 200 || result.statusCode >= 300))
            throw new Error('Victory transaction failed.');
        } else {
          await this.container.item(id, PARTITION).replace(room, {
            accessCondition: {type: 'IfMatch', condition: room._etag}
          });
        }
        return value;
      } catch (error) {
        if (error.code === 412) continue;
        throw error;
      }
    }
    throw new Error('The match is busy. Please retry.');
  }
}
