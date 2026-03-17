from app.driver.proxmox_client import ProxmoxClient

class SDNManager:
    @staticmethod
    def detect_sdn(client: ProxmoxClient) -> bool:
        try:
            api = client.get_api()
            api.cluster.sdn.get()
            return True
        except Exception:
            return False

    @staticmethod
    def ensure_vnet(client: ProxmoxClient, vxlan_id: int) -> None:
        api = client.get_api()
        zone_id = f"zone{vxlan_id}"
        vnet_id = f"vnet{vxlan_id}"
        try:
            zones = api.cluster.sdn.zones.get()
            zone_ids = [z["zone"] for z in zones]
            if zone_id not in zone_ids:
                api.cluster.sdn.zones.post(zone=zone_id, type="vxlan", peers="")
        except Exception:
            pass
        try:
            vnets = api.cluster.sdn.vnets.get()
            vnet_ids = [v["vnet"] for v in vnets]
            if vnet_id not in vnet_ids:
                api.cluster.sdn.vnets.post(vnet=vnet_id, zone=zone_id, tag=vxlan_id)
        except Exception:
            pass
