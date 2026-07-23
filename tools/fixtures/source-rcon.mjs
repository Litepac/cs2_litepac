import net from "node:net";

const [host = "127.0.0.1", portText = "27015", password, ...commandParts] =
  process.argv.slice(2);
const port = Number(portText);
const command = commandParts.join(" ").trim();

if (!password || !command || !Number.isInteger(port)) {
  console.error(
    "usage: node tools/fixtures/source-rcon.mjs <host> <port> <password> <command>",
  );
  process.exitCode = 2;
} else {
  const socket = net.createConnection({ host, port });
  let pending = Buffer.alloc(0);
  const packets = [];
  const waiters = [];

  function encodePacket(id, type, body) {
    const bodyBytes = Buffer.from(body, "utf8");
    const packet = Buffer.alloc(4 + 4 + 4 + bodyBytes.length + 2);
    packet.writeInt32LE(packet.length - 4, 0);
    packet.writeInt32LE(id, 4);
    packet.writeInt32LE(type, 8);
    bodyBytes.copy(packet, 12);
    return packet;
  }

  function dispatch(packet) {
    const waiter = waiters.shift();
    if (waiter) {
      waiter(packet);
    } else {
      packets.push(packet);
    }
  }

  function readPacket() {
    const packet = packets.shift();
    if (packet) {
      return Promise.resolve(packet);
    }
    return new Promise((resolve) => waiters.push(resolve));
  }

  socket.on("data", (chunk) => {
    pending = Buffer.concat([pending, chunk]);
    while (pending.length >= 4) {
      const size = pending.readInt32LE(0);
      if (pending.length < size + 4) {
        break;
      }
      const raw = pending.subarray(0, size + 4);
      pending = pending.subarray(size + 4);
      dispatch({
        id: raw.readInt32LE(4),
        type: raw.readInt32LE(8),
        body: raw.subarray(12, raw.length - 2).toString("utf8"),
      });
    }
  });

  await new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("error", reject);
  });

  socket.write(encodePacket(1, 3, password));
  let auth;
  do {
    auth = await readPacket();
  } while (auth.type !== 2);

  if (auth.id === -1) {
    socket.destroy();
    throw new Error("RCON authentication failed");
  }

  socket.write(encodePacket(2, 2, command));
  const response = await readPacket();
  if (response.id !== 2) {
    socket.destroy();
    throw new Error(`unexpected RCON response id ${response.id}`);
  }

  process.stdout.write(response.body);
  if (response.body && !response.body.endsWith("\n")) {
    process.stdout.write("\n");
  }
  socket.end();
}
