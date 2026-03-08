const PVE_HOST = import.meta.env.PVE_HOST;
const PVE_TOKEN_ID = import.meta.env.PVE_TOKEN_ID;
const PVE_TOKEN_SECRET = import.meta.env.PVE_TOKEN_SECRET;

const AUTH_HEADER = `PVEAPIToken=${PVE_TOKEN_ID}=${PVE_TOKEN_SECRET}`;

async function pveRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${PVE_HOST}/api2/json${path}`;

    const headers: Record<string, string> = {
        "Authorization": AUTH_HEADER,
        ...(options.headers as Record<string, string>),
    };
    if (options.body && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
        ...options,
        headers,
        // Required if your PVE uses a self-signed cert
       // @ts-ignore
        dispatcher: new (await import("undici")).Agent({
            connect: { rejectUnauthorized: false }
        })
    });

    if (!response.ok) {
        throw new Error(`PVE API error: ${response.status} ${response.statusText}`);
    }

    const json = await response.json();
    return json.data as T;
}

export async function getNodes() {
    return pveRequest<PVENode[]>("/nodes");
}

export async function getVMs(node: string) {
    return pveRequest<PVEVM[]>(`/nodes/${node}/qemu`);
}

export async function getVMStatus(node: string, vmid: number) {
    return pveRequest<PVEVMStatus>(`/nodes/${node}/qemu/${vmid}/status/current`);
}

export async function startVM(node: string, vmid: number) {
    return pveRequest(`/nodes/${node}/qemu/${vmid}/status/start`, { method: "POST" });
}

export async function stopVM(node: string, vmid: number) {
    return pveRequest(`/nodes/${node}/qemu/${vmid}/status/stop`, { method: "POST" });
}

export async function shutdownVM(node: string, vmid: number) {
    return pveRequest(`/nodes/${node}/qemu/${vmid}/status/shutdown`, { method: "POST" });
}

export async function rebootVM(node: string, vmid: number) {
    return pveRequest(`/nodes/${node}/qemu/${vmid}/status/reboot`, { method: "POST" });
}

export async function updateVMConfig(node: string, vmid: number, config: Partial<PVEVMConfig>) {
    return pveRequest(`/nodes/${node}/qemu/${vmid}/config`, {
        method: "PUT",
        body: JSON.stringify(config),
    });
}

export async function getVNCProxy(node: string, vmid: number) {
    return pveRequest<{ ticket: string; port: number; cert?: string }>(
        `/nodes/${node}/qemu/${vmid}/vncproxy`,
        { method: "POST", body: JSON.stringify({ websocket: 1 }) }
    );
}

export async function getStorage(node: string) {
    return pveRequest<PVEStorage[]>(`/nodes/${node}/storage`);
}

export async function getNextVmid(): Promise<number> {
    return pveRequest<number>("/cluster/nextid");
}

export async function createVM(node: string, params: Record<string, string | number>) {
    const body = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) body.set(k, String(v));
    return pveRequest<string>(`/nodes/${node}/qemu`, {
        method: "POST",
        body: body.toString(),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
}

export async function addVMToPool(poolid: string, vmid: number) {
    const body = new URLSearchParams({ vms: String(vmid) });
    return pveRequest(`/pools/${poolid}`, {
        method: "PUT",
        body: body.toString(),
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
    });
}

export async function getVMConfig(node: string, vmid: number) {
    return pveRequest<PVEVMConfig>(`/nodes/${node}/qemu/${vmid}/config`);
}

export async function deleteVM(node: string, vmid: number) {
    return pveRequest<string>(`/nodes/${node}/qemu/${vmid}?purge=1&destroy-unreferenced-disks=1`, {
        method: "DELETE",
    });
}

export interface PVEVMConfig {
    cores?: number;
    sockets?: number;
    memory?: number;
    description?: string;
    name?: string;
    [key: string]: unknown;
}

export async function getPools() {
    return pveRequest<PVEPool[]>("/pools");
}

export async function getPool(poolid: string) {
    return pveRequest<PVEPoolDetail>(`/pools/${poolid}`);
}

export interface PVEPool {
    poolid: string;
    comment?: string;
}

export interface PVEPoolDetail extends PVEPool {
    members: Array<{ vmid: number; type: string; node: string }>;
}

export interface PVENode {
    node: string;
    status: string;
    cpu: number;
    maxcpu: number;
    mem: number;
    maxmem: number;
    disk: number;
    maxdisk: number;
    uptime: number;
}

export interface PVEVM {
    vmid: number;
    name: string;
    status: string;
    cpu: number;
    mem: number;
    maxmem: number;
    disk: number; // current disk write I/O (bytes)
    maxdisk: number;
    uptime: number;
}

export interface PVEVMStatus extends PVEVM {
    qmpstatus: string;
    pid: number;
}

export interface PVEStorage {
    storage: string;
    type: string;
    active: number;
    used: number;
    avail: number;
    total: number;
    content: string;
}