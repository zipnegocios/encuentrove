import { Router, type Request, type Response } from "express";
import { getFeedCached, subscribeFeed, type ApiFeedItem } from "../lib/feed";

const router = Router();

function writeSnapshot(res: Response, items: ApiFeedItem[]): void {
  res.write(`data: ${JSON.stringify(items)}\n\n`);
}

router.get("/events", async (req: Request, res: Response) => {
  // Long-lived connection — disable Node's default per-request timeout so it
  // isn't forcibly closed every few minutes (the client would just reconnect,
  // but there's no reason to make it).
  req.socket.setTimeout(0);

  res.set({
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });
  res.flushHeaders();

  writeSnapshot(res, await getFeedCached());

  const unsubscribe = subscribeFeed((items) => writeSnapshot(res, items));
  req.on("close", unsubscribe);
});

export default router;
