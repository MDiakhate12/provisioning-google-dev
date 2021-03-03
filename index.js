const express = require('express');
const cors = require('cors');

const PORT = process.env.PORT || 4000;


const app = express()

app.use(cors())
app.use(express.json())

app.post("/", async (req, res) => {
    try {

        const {
            projectName,
            projectArchitecture,
            applicationType,
            environment,
            SLA,
            dataSize,
            dependencies,
            connectedApplications,
            costEstimation,
            provider,
            instanceGroupName,
            numberOfVm,
            cpu,
            memory,
            disk,
            osType,
            osImage,
        } = req.body

        const util = require('util')

        const exec = util.promisify(require('child_process').exec);

        let instance = {
            number_of_vm: numberOfVm,
            vm_group_name: instanceGroupName,
            cpu: cpu,
            memory: memory,
            disk_size_gb: disk,
            image_project: osType,
            image_family: osImage,
            application_type: applicationType,
        }

        if(process.env.USER) {            
            instance['user'] = process.env.USER
        }

        if(process.env.KEY_LOCATION) {
            let keyLocation = process.env.KEY_LOCATION

            instance['private_key'] = keyLocation
            instance['public_key'] = `${keyLocation}.pub`
        }

        let resourceName = instanceGroupName.replace('/-/g', '_').trim().toLowerCase()

        const fs = require('fs')

        fs.writeFile(`terraform/google/${resourceName}.auto.tfvars.json`, JSON.stringify(instance), (err) => {
            if (err) {
                console.error(err.message)
            }
            else {
                console.log(`Created file ${resourceName}.auto.tfvars.json from request...`)
            }
        })

        if (applicationType === "dev" && provider === "gcp" && projectArchitecture === "micro") {
            try {
                let { stdout: output } = await exec(`make terraform-apply-google RESOURCE_NAME=${resourceName}`)
                // await exec(`make terraform-apply-google RESOURCE_NAME=${resourceName}`)
                fs.readFile(`terraform/google/${resourceName}.hosts.json`, (err, data) => {
                    if(err) {
                        console.error("Host file not found !")
                    };
                    vmResult = JSON.parse(data) 
                })
                console.log(output)
            } catch (error) {
                console.error(error.message)
                let { stdout: output } = await exec(`cd terraform/google && terraform destroy -auto-approve -state=${resourceName}.tfstate`)
                console.log(output)
            } finally {
                await exec(`rm terraform/google/${resourceName}*`)
            }
            return res.send(vmResult)
        } else {
            return res.send("Cannot provide this kind of instance yet.")
        }
    } catch (error) {
        console.error(error.message)
    }

})

app.listen(PORT, () => {
    console.log('Listenning on port: ', PORT)
})