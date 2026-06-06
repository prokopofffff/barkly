# Cloud CDN in front of the media bucket. Created only when var.cdn_cname is set,
# because Cloud CDN requires a domain (CNAME) you control and the CDN provider to
# be activated on the account once (Console → CDN → Activate provider).

resource "yandex_cdn_origin_group" "media" {
  count    = var.cdn_cname != "" ? 1 : 0
  name     = "${var.project}-media-origin"
  use_next = true

  origin {
    source  = "${var.media_bucket_name}.storage.yandexcloud.net"
    enabled = true
  }
}

resource "yandex_cdn_resource" "media" {
  count           = var.cdn_cname != "" ? 1 : 0
  cname           = var.cdn_cname
  origin_group_id = yandex_cdn_origin_group.media[0].id
  active          = true

  # Serve over HTTPS; let Yandex manage the certificate for the CNAME.
  ssl_certificate {
    type = "lets_encrypt_gcore"
  }

  options {
    edge_cache_settings = 345600 # 4 days
    ignore_cookie       = true
    # Rewrite the Host header so Object Storage resolves the right bucket.
    custom_host_header = "${var.media_bucket_name}.storage.yandexcloud.net"
  }
}
