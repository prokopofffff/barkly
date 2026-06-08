output "static_ip_address" {
  description = "Reserved external IPv4 address."
  value       = yandex_vpc_address.static.external_ipv4_address[0].address
}

output "static_ip_id" {
  description = "ID of the reserved address resource (for attaching to a VM/LB)."
  value       = yandex_vpc_address.static.id
}

output "media_bucket_name" {
  description = "Object Storage bucket name."
  value       = yandex_storage_bucket.media.bucket
}

output "media_bucket_endpoint" {
  description = "S3-compatible endpoint for the bucket."
  value       = "https://storage.yandexcloud.net"
}

output "storage_access_key" {
  description = "S3 access key ID for the storage service account."
  value       = yandex_iam_service_account_static_access_key.storage.access_key
  sensitive   = true
}

output "storage_secret_key" {
  description = "S3 secret access key. Retrieve with: terraform output -raw storage_secret_key"
  value       = yandex_iam_service_account_static_access_key.storage.secret_key
  sensitive   = true
}

# --- Network / compute ---------------------------------------------------------

output "network_id" {
  description = "VPC network ID."
  value       = yandex_vpc_network.main.id
}

output "subnet_id" {
  description = "Subnet ID."
  value       = yandex_vpc_subnet.main.id
}

output "worker_public_ip" {
  description = "Ingestion worker public IP (the reserved static address)."
  value       = yandex_compute_instance.worker.network_interface[0].nat_ip_address
}

output "worker_internal_ip" {
  description = "Ingestion worker private IP inside the VPC."
  value       = yandex_compute_instance.worker.network_interface[0].ip_address
}

output "worker_s3_access_key" {
  description = "S3 access key id for the worker SA (object read/write). Use for uploads."
  value       = yandex_iam_service_account_static_access_key.worker.access_key
  sensitive   = true
}

output "worker_s3_secret_key" {
  description = "S3 secret key for the worker SA. terraform output -raw worker_s3_secret_key"
  value       = yandex_iam_service_account_static_access_key.worker.secret_key
  sensitive   = true
}

# --- CDN -----------------------------------------------------------------------

output "cdn_cname" {
  description = "CDN domain (empty if CDN disabled)."
  value       = var.cdn_cname != "" ? var.cdn_cname : null
}

# --- PostgreSQL ----------------------------------------------------------------

output "pg_cluster_id" {
  description = "Managed PostgreSQL cluster ID."
  value       = yandex_mdb_postgresql_cluster.main.id
}

output "pg_host_fqdn" {
  description = "PostgreSQL host FQDN to connect to."
  value       = yandex_mdb_postgresql_cluster.main.host[0].fqdn
}

output "pg_connection_uri" {
  description = "PostgreSQL connection URI (password omitted)."
  value       = "postgresql://${var.pg_user}@${yandex_mdb_postgresql_cluster.main.host[0].fqdn}:6432/${var.pg_database}?sslmode=require"
}
