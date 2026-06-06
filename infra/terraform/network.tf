# Reserved (static) external IPv4 address. Survives VM/load-balancer recreation,
# so DNS and firewall rules can point at a stable IP. Attach it later to a
# compute instance or network load balancer via its `external_ipv4_address`.
resource "yandex_vpc_address" "static" {
  name = "${var.project}-static-ip"

  external_ipv4_address {
    zone_id = var.zone
  }

  labels = local.labels
}
