from proxmoxer import ProxmoxAPI
from app.models.cluster import Cluster
from app.core.encryption import decrypt

class ProxmoxClient:
    def __init__(self, cluster: Cluster):
        self.cluster = cluster
        token_id = cluster.api_token_id
        token_secret = decrypt(cluster.api_token_secret)
        # token_id format: user@realm!tokenname
        user_part, token_name = token_id.rsplit("!", 1)
        import urllib.parse
        parsed = urllib.parse.urlparse(cluster.api_url)
        host = parsed.hostname
        port = parsed.port or 8006
        self.api = ProxmoxAPI(
            host,
            port=port,
            user=user_part,
            token_name=token_name,
            token_value=token_secret,
            verify_ssl=cluster.tls_verify,
            service="PVE",
        )

    def get_api(self) -> ProxmoxAPI:
        return self.api
