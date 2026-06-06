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
