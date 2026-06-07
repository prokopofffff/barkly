variable "yc_token" {
  description = "Yandex Cloud OAuth/IAM token. If empty, the provider falls back to the YC_TOKEN env var or the `yc` CLI credentials."
  type        = string
  default     = ""
  sensitive   = true
}

variable "cloud_id" {
  description = "Yandex Cloud cloud ID (yc config get cloud-id)."
  type        = string
}

variable "folder_id" {
  description = "Yandex Cloud folder ID (yc config get folder-id)."
  type        = string
}

variable "zone" {
  description = "Default availability zone."
  type        = string
  default     = "ru-central1-a"
}

variable "region" {
  description = "Object Storage region."
  type        = string
  default     = "ru-central1"
}

variable "project" {
  description = "Short project slug used to name/prefix resources."
  type        = string
  default     = "barkly"
}

variable "media_bucket_name" {
  description = "Globally-unique name for the media Object Storage bucket."
  type        = string
  default     = "barkly-media"
}

variable "media_bucket_max_size" {
  description = "Max bucket size in bytes (0 = unlimited). Default 50 GiB to cap surprise costs."
  type        = number
  default     = 53687091200
}

# --- Network -------------------------------------------------------------------

variable "subnet_cidr" {
  description = "CIDR block for the subnet."
  type        = string
  default     = "10.10.0.0/24"
}

# --- Compute worker ------------------------------------------------------------

variable "worker_cores" {
  description = "vCPU count for the ingestion worker."
  type        = number
  default     = 2
}

variable "worker_memory_gb" {
  description = "RAM (GiB) for the ingestion worker."
  type        = number
  default     = 4
}

variable "worker_disk_gb" {
  description = "Boot disk size (GiB) for the ingestion worker."
  type        = number
  default     = 30
}

variable "worker_image_family" {
  description = "Image family for the worker boot disk."
  type        = string
  default     = "ubuntu-2204-lts"
}

variable "ssh_public_key_path" {
  description = "Path to the SSH public key installed on the worker (user 'barkly')."
  type        = string
  default     = "~/.ssh/id_ed25519.pub"
}

# --- Cloud CDN -----------------------------------------------------------------

variable "cdn_cname" {
  description = "Custom domain (CNAME) for the CDN resource, e.g. cdn.barkly.app. Leave empty to skip CDN — Cloud CDN requires a domain you control and the CDN provider activated on the account."
  type        = string
  default     = ""
}

# --- Managed PostgreSQL --------------------------------------------------------

variable "pg_version" {
  description = "PostgreSQL major version."
  type        = string
  default     = "16"
}

variable "pg_resource_preset" {
  description = "Host resource preset (e.g. s2.micro = 2 vCPU / 8 GB)."
  type        = string
  default     = "s2.micro"
}

variable "pg_disk_gb" {
  description = "PostgreSQL disk size (GiB)."
  type        = number
  default     = 20
}

variable "pg_database" {
  description = "Application database name."
  type        = string
  default     = "barkly"
}

variable "pg_user" {
  description = "Application database user."
  type        = string
  default     = "barkly"
}

variable "pg_password" {
  description = "Password for the application DB user. Set in terraform.tfvars (gitignored)."
  type        = string
  default     = ""
  sensitive   = true
}

variable "pg_public_access" {
  description = "Expose the PG host on a public IP (otherwise reachable only inside the VPC)."
  type        = bool
  default     = false
}
