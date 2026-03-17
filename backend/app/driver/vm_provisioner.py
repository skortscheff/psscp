import time
from app.driver.proxmox_client import ProxmoxClient

class VMProvisioner:
    @staticmethod
    def find_free_vmid(client: ProxmoxClient) -> int:
        api = client.get_api()
        return api.cluster.nextid.get()

    @staticmethod
    def clone_template(client: ProxmoxClient, template_id: int, vmid: int, name: str) -> int:
        api = client.get_api()
        nodes = api.nodes.get()
        # Find which node hosts the template
        for node in nodes:
            node_name = node["node"]
            try:
                vms = api.nodes(node_name).qemu.get()
                for vm in vms:
                    if vm["vmid"] == template_id:
                        api.nodes(node_name).qemu(template_id).clone.post(
                            newid=vmid,
                            name=name,
                            full=1,
                        )
                        return vmid
            except Exception:
                continue
        raise RuntimeError(f"Template {template_id} not found on any node")

    @staticmethod
    def configure_vm(client: ProxmoxClient, vmid: int, vcpus: int, ram_mb: int) -> None:
        api = client.get_api()
        nodes = api.nodes.get()
        for node in nodes:
            node_name = node["node"]
            try:
                vms = api.nodes(node_name).qemu.get()
                for vm in vms:
                    if vm["vmid"] == vmid:
                        api.nodes(node_name).qemu(vmid).config.put(
                            cores=vcpus,
                            memory=ram_mb,
                        )
                        return
            except Exception:
                continue

    @staticmethod
    def _find_node(api, vmid: int) -> str:
        nodes = api.nodes.get()
        for node in nodes:
            node_name = node["node"]
            try:
                vms = api.nodes(node_name).qemu.get()
                for vm in vms:
                    if vm["vmid"] == vmid:
                        return node_name
            except Exception:
                continue
        raise RuntimeError(f"VM {vmid} not found on any node")

    @staticmethod
    def attach_network(client: ProxmoxClient, vmid: int, bridge: str) -> None:
        api = client.get_api()
        node_name = VMProvisioner._find_node(api, vmid)
        api.nodes(node_name).qemu(vmid).config.put(net0=f"virtio,bridge={bridge}")

    @staticmethod
    def start_vm(client: ProxmoxClient, vmid: int) -> None:
        api = client.get_api()
        node_name = VMProvisioner._find_node(api, vmid)
        api.nodes(node_name).qemu(vmid).status.start.post()

    @staticmethod
    def stop_vm(client: ProxmoxClient, vmid: int) -> None:
        api = client.get_api()
        node_name = VMProvisioner._find_node(api, vmid)
        api.nodes(node_name).qemu(vmid).status.stop.post()

    @staticmethod
    def reboot_vm(client: ProxmoxClient, vmid: int) -> None:
        api = client.get_api()
        node_name = VMProvisioner._find_node(api, vmid)
        api.nodes(node_name).qemu(vmid).status.reboot.post()

    @staticmethod
    def delete_vm(client: ProxmoxClient, vmid: int) -> None:
        api = client.get_api()
        node_name = VMProvisioner._find_node(api, vmid)
        api.nodes(node_name).qemu(vmid).delete()

    @staticmethod
    def get_ip_address(client: ProxmoxClient, vmid: int) -> str | None:
        api = client.get_api()
        node_name = VMProvisioner._find_node(api, vmid)
        try:
            result = api.nodes(node_name).qemu(vmid).agent("network-get-interfaces").get()
            for iface in result.get("result", []):
                if iface.get("name") == "lo":
                    continue
                for ip_info in iface.get("ip-addresses", []):
                    if ip_info.get("ip-address-type") == "ipv4":
                        return ip_info["ip-address"]
        except Exception:
            pass
        return None
