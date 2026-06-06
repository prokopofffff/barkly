# --- Ingestion worker service account -----------------------------------------
# The instance authenticates to Object Storage via its attached SA (IAM token
# from metadata) — no static keys live on the box.

resource "yandex_iam_service_account" "worker" {
  name        = "${var.project}-worker-sa"
  description = "Ingestion worker: reads/writes media in the bucket."
}

resource "yandex_resourcemanager_folder_iam_member" "worker_storage" {
  folder_id = var.folder_id
  role      = "storage.editor"
  member    = "serviceAccount:${yandex_iam_service_account.worker.id}"
}

# --- Boot image ---------------------------------------------------------------

data "yandex_compute_image" "worker" {
  family = var.worker_image_family
}

# --- Instance -----------------------------------------------------------------

resource "yandex_compute_instance" "worker" {
  name        = "${var.project}-ingestion-worker"
  platform_id = "standard-v3"
  zone        = var.zone

  service_account_id = yandex_iam_service_account.worker.id

  resources {
    cores         = var.worker_cores
    memory        = var.worker_memory_gb
    core_fraction = 100
  }

  boot_disk {
    initialize_params {
      image_id = data.yandex_compute_image.worker.id
      size     = var.worker_disk_gb
      type     = "network-ssd"
    }
  }

  network_interface {
    subnet_id          = yandex_vpc_subnet.main.id
    security_group_ids = [yandex_vpc_security_group.worker.id]
    nat                = true
    # Attach the reserved static IP instead of an ephemeral one.
    nat_ip_address = yandex_vpc_address.static.external_ipv4_address[0].address
  }

  metadata = {
    ssh-keys  = "barkly:${file(pathexpand(var.ssh_public_key_path))}"
    user-data = local.worker_cloud_init
  }

  labels = local.labels

  depends_on = [yandex_resourcemanager_folder_iam_member.worker_storage]
}

locals {
  # Installs the transcoding toolchain. App deploy (the worker code) is handled
  # separately — this just provisions ffmpeg + yt-dlp + the YC CLI.
  worker_cloud_init = <<-EOT
    #cloud-config
    package_update: true
    packages:
      - ffmpeg
      - python3-pip
      - jq
    runcmd:
      - pip3 install --upgrade yt-dlp
      - curl -sSL https://storage.yandexcloud.net/yandexcloud/yandex-cloud/release/bin/linux/amd64/yc -o /usr/local/bin/yc && chmod +x /usr/local/bin/yc
  EOT
}
