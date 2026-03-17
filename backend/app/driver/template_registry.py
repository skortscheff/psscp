from dataclasses import dataclass
from typing import Optional
from app.driver.proxmox_client import ProxmoxClient

@dataclass
class TemplateInfo:
    id: str          # e.g. "100"
    name: str
    os_type: Optional[str]

class TemplateRegistry:
    @staticmethod
    def list_templates(client: ProxmoxClient) -> list[dict]:
        api = client.get_api()
        templates = []
        nodes = api.nodes.get()
        for node in nodes:
            node_name = node["node"]
            vms = api.nodes(node_name).qemu.get()
            for vm in vms:
                if vm.get("template", 0) == 1:
                    templates.append({
                        "id": str(vm["vmid"]),
                        "name": vm.get("name", f"vm-{vm['vmid']}"),
                        "os_type": vm.get("ostype"),
                    })
        return templates
