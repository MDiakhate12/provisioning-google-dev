terraform-apply:
	cd terraform/ && \
	 mv main.tf ${RESOURCE_NAME}.tf && \
	 echo "Created file: ${RESOURCE_NAME}.tf from template..." && \
	 terraform init && \
	 terraform plan -out ${RESOURCE_NAME}.plan && \
	 terraform apply -state-out="${RESOURCE_NAME}.tfstate" "${RESOURCE_NAME}.plan" && \
	 terraform show  
