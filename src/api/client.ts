const PVE_HOST = import.meta.env.PVE_HOST;
const PVE_TOKEN_ID = import.meta.env.PVE_TOKEN_ID;
const PVE_TOKEN_SECRET = import.meta.env.PVE_TOKEN_SECRET;

const AUTH_HEADER = `PVEAPIToken=${PVE_TOKEN_ID}=${PVE_TOKEN_SECRET}`;

async function pveRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
    const url = `${PVE_HOST}/api2/json${path}`;

    const response = await fetch(url, {
        ...options,
        headers: {
            "Authorization": AUTH_HEADER,
            "Content-Type": "application/json",
            ...options.headers,
        },
        // Required if your PVE uses a self-signed cert - remove in production
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

export async function getStorage(node: string) {
    return pveRequest<PVEStorage[]>(`/nodes/${node}/storage`);
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
    disk: number;
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