# Managed Service for PostgreSQL — Postgres + Zero sync (logical replication/CDC).

resource "yandex_mdb_postgresql_cluster" "main" {
  name        = "${var.project}-pg"
  environment = "PRODUCTION"
  network_id  = yandex_vpc_network.main.id
  labels      = local.labels

  security_group_ids = [yandex_vpc_security_group.postgres.id]

  config {
    version = var.pg_version

    resources {
      resource_preset_id = var.pg_resource_preset
      disk_type_id       = "network-ssd"
      disk_size          = var.pg_disk_gb
    }

    # Logical replication (what Zero's CDC needs) is the DEFAULT wal_level on
    # Managed PG — no postgresql_config tuning required. The app user's
    # `mdb_replication` grant (below) is what authorizes the replication stream.

    access {
      # Allow connections from outside the VPC only when explicitly enabled.
      web_sql = false
    }
  }

  host {
    zone             = var.zone
    subnet_id        = yandex_vpc_subnet.main.id
    assign_public_ip = var.pg_public_access
  }
}

resource "yandex_mdb_postgresql_database" "app" {
  cluster_id = yandex_mdb_postgresql_cluster.main.id
  name       = var.pg_database
  owner      = yandex_mdb_postgresql_user.app.name
}

resource "yandex_mdb_postgresql_user" "app" {
  cluster_id = yandex_mdb_postgresql_cluster.main.id
  name       = var.pg_user
  password   = var.pg_password

  # mdb_replication lets this user drive Zero's logical replication.
  grants = ["mdb_replication"]

  # Connection pooler: Zero wants a direct (session) connection for replication.
  conn_limit = 50
}
