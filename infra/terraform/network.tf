# --- VPC ----------------------------------------------------------------------

resource "yandex_vpc_network" "main" {
  name        = "${var.project}-net"
  description = "Primary network for the Barkly backend."
  labels      = local.labels
}

resource "yandex_vpc_subnet" "main" {
  name           = "${var.project}-subnet-${var.zone}"
  zone           = var.zone
  network_id     = yandex_vpc_network.main.id
  v4_cidr_blocks = [var.subnet_cidr]
  labels         = local.labels
}

# --- Reserved static external IPv4 --------------------------------------------
# Survives VM recreation, so DNS/firewall can point at a stable IP. Attached to
# the ingestion worker in compute.tf.
resource "yandex_vpc_address" "static" {
  name = "${var.project}-static-ip"

  external_ipv4_address {
    zone_id = var.zone
  }

  labels = local.labels
}

# --- Security groups ----------------------------------------------------------

# Ingestion worker: allow SSH in, all egress out.
resource "yandex_vpc_security_group" "worker" {
  name        = "${var.project}-worker-sg"
  network_id  = yandex_vpc_network.main.id
  description = "Ingress SSH + egress all for the ingestion worker."
  labels      = local.labels

  ingress {
    protocol       = "TCP"
    description    = "SSH"
    port           = 22
    v4_cidr_blocks = ["0.0.0.0/0"]
  }

  egress {
    protocol       = "ANY"
    description    = "All outbound"
    v4_cidr_blocks = ["0.0.0.0/0"]
  }
}

# Managed PostgreSQL: allow 6432 from inside the VPC (and optionally anywhere
# when public access is enabled).
resource "yandex_vpc_security_group" "postgres" {
  name        = "${var.project}-pg-sg"
  network_id  = yandex_vpc_network.main.id
  description = "PostgreSQL access (6432) from the VPC."
  labels      = local.labels

  ingress {
    protocol       = "TCP"
    description    = "PostgreSQL pooler/direct from VPC"
    port           = 6432
    v4_cidr_blocks = var.pg_public_access ? [var.subnet_cidr, "0.0.0.0/0"] : [var.subnet_cidr]
  }

  egress {
    protocol       = "ANY"
    description    = "All outbound"
    v4_cidr_blocks = ["0.0.0.0/0"]
  }
}
