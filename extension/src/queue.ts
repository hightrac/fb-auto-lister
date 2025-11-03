const BACKEND_URL = 'http://localhost:3000';

interface QueueItem {
  vehicle: any;
  type: string;
  resolve: () => void;
  reject: (err: any) => void;
}

class PostQueue {
  private queue: QueueItem[] = [];
  private processing = false;

  enqueue(vehicle: any, type: string): Promise<void> {
    return new Promise((resolve, reject) => {
      this.queue.push({ vehicle, type, resolve, reject });
      this.process();
    });
  }

  private async process() {
    if (this.processing || this.queue.length === 0) return;
    this.processing = true;
    const item = this.queue.shift()!;

    try {
      const token = localStorage.getItem('token');
      const resp = await fetch(`${BACKEND_URL}/activities/log`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'post', details: item.vehicle })
      });

      if (!resp.ok) {
        const err = await resp.json();
        if (resp.status === 429) {
          const wait = err.wait_minutes ? err.wait_minutes * 60 * 1000 : 120000;
          setTimeout(() => {
            this.queue.unshift(item);
            this.processing = false;
            this.process();
          }, wait);
          return;
        }
        throw err;
      }

      await this.executePost(item.vehicle);
      const delay = 120000 + Math.random() * 180000;
      setTimeout(() => {
        item.resolve();
        this.processing = false;
        this.process();
      }, delay);
    } catch (err) {
      item.reject(err);
      this.processing = false;
    }
  }

  private executePost(vehicle: any) {
    return new Promise<void>((resolve) => {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.scripting.executeScript({
          target: { tabId: tabs[0].id! },
          func: (v) => {
            const title = document.querySelector('input[placeholder*="What are you selling"]') as HTMLInputElement;
            const price = document.querySelector('input[placeholder*="Price"]') as HTMLInputElement;
            const desc = document.querySelector('textarea') as HTMLTextAreaElement;
            if (title) title.value = v.title;
            if (price) price.value = v.price.replace('$', '');
            if (desc) desc.value = v.desc;
            setTimeout(() => {
              const btn = document.querySelector('button[type="submit"]') as HTMLButtonElement;
              btn?.click();
            }, 15000);
          },
          args: [vehicle]
        }, resolve);
      });
    });
  }
}

export const postQueue = new PostQueue();
