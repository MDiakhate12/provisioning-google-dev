terraform-apply-google:
	cd terraform/google/ && \
	 echo "ressource name: ${RESOURCE_NAME}" && \
	 sed -e "s/RESOURCE_NAME/${RESOURCE_NAME}/" template > ./${RESOURCE_NAME}.tf && \
	 echo "Created file: ${RESOURCE_NAME}.tf from template..." && \
	 terraform init && \
	 terraform plan -out ${RESOURCE_NAME}.plan && \
	 terraform apply -state-out="${RESOURCE_NAME}.tfstate" "${RESOURCE_NAME}.plan" && \
	 terraform show 
