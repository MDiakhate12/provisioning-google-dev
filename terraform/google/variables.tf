variable "vm_group_name" {
  type    = string
  default = "diaf"
}

variable "number_of_vm" {
  type    = number
  default = 1
}

variable "cpu" {
  type    = number
  default = 1
}

variable "memory" {
  type    = number
  default = 1024
}

variable "region" {
  type    = string
  default = "europe-west1"
}

variable "zone" {
  type    = string
  default = "europe-west1-b"
}

variable "image_project" {
  type    = string
  default = "debian-cloud"
}

variable "image_family" {
  type    = string
  default = "debian-9"
}

variable "disk_size_gb" {
  type    = number
  default = 10
}

variable "private_key" {
  type    = string
  default = "~/.ssh/google_compute_engine"
}

variable "application_type" {
  type    = string
  default = "dev"
}
