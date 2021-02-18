provider "google" {
    project "ept-project-301112"
}

data "google_compute_instance_group" "all" {
    name = "${var.vm_group_name}-instance-group"
    zone = "${var.zone}"
}