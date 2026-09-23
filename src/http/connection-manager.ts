import { CanvaService } from '../canva-service.js';
import { CanvaRemoteClient } from '../remote-client.js';

export class CanvaConnectionManager {
  private pending: Promise<CanvaService> | undefined;
  private client: CanvaRemoteClient | undefined;

  async getService(): Promise<CanvaService> {
    if (!this.pending) {
      this.pending = CanvaRemoteClient.connect()
        .then((client) => {
          this.client = client;
          return new CanvaService(client);
        })
        .catch((error: unknown) => {
          this.pending = undefined;
          throw error;
        });
    }
    return this.pending;
  }

  async close(): Promise<void> {
    const client = this.client;
    this.client = undefined;
    this.pending = undefined;
    if (client) await client.close();
  }
}
