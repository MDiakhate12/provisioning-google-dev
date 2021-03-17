const express = require('express');
const cors = require('cors');
const fs = require('fs')
const Compute = require('@google-cloud/compute');
const { Storage } = require('@google-cloud/storage');
const util = require('util');
const exec = util.promisify(require('child_process').exec);

const PORT = process.env.PORT || 4000;
const WAIT_BEFORE_EXECUTE = 3000; // wait 6 seconds

const app = express()

const templateRepository = 'template_repository';
const templateRegistry = 'template_registry';

const files = [
    'terraform/google/mern/dev/template',
    'terraform/google/mern/dev/variables.tf',
    'modules/react/dev/init-react.sh',
    'modules/nodejs/dev/init-nodejs.sh',
    'modules/mongodb/init-mongodb.sh',
]

app.use(cors())
app.use(express.json())

app.post("/", async (req, res) => {

    try {

        const {
            instanceGroupName,
            projectName,
        } = req.body

        // Replace hyphens by underscores
        let resourceName = instanceGroupName.replace(/-/g, '_').trim().toLowerCase()
        // let folders = "backend"
        let timestamp = Date.now()

        // Download the files
        downloadFiles(files, "./terraform/")


        // Wait 3 seconds for the dowload
        setTimeout(() => {

            createTerraformVariableFile(req.body, resourceName)

            executeTerraform(resourceName)
                .then(async () => {
                    // Export the generated terraform directory to template registry
                    uploadFiles(projectName, instanceGroupName, timestamp)

                    // Get VM Instances
                    getInstances(instanceGroupName)
                        .then(instances => {
                            console.log(instances)
                            res.send(instances)
                        }).catch(console.error)
                })
                .catch((error) => { console.error(error); res.status(500).send("Error during creation.") })

        }, WAIT_BEFORE_EXECUTE);

    } catch (error) {
        console.error(error)
        res.status(500).send("Server error.")

    }

})

const downloadFiles = (files, path) => {

    // Creates a client
    const storage = new Storage();

    files.map(async (file) => {
        let destination = `${path}/${file.substring(file.lastIndexOf("/") + 1)}`
        try {
            await storage.bucket(templateRepository).file(file).download({ destination })
            console.log(`gs://${templateRepository}/${file} downloaded to ${destination}.`)
        }
        catch (error) {
            console.error(error)
        }
    })
}

const uploadFiles = async (projectName, instanceGroupName, timestamp) => {

    const storage = new Storage();

    let path = `terraform`

    return fs.readdir(path, async (err, files) => {
        if (err) {
            console.error(err)
            return
        }

        console.log("TIMESTAMP:", timestamp)

        // Import and remove each file one by one 
        files.forEach(file => {
            if (!fs.statSync(`${path}/${file}`).isDirectory()) {
                let destination = `${instanceGroupName}-${timestamp}/${file}`
                storage
                    .bucket(templateRegistry)
                    .upload(`${path}/${file}`, { destination })
                    .then(async () => {
                        console.log(`${file} uploaded successfuly`)
                        exec(`rm -rf ${path}/${file}`)
                            .then((() => console.log(`Deleted ${file}.`)))
                            .catch(console.error)
                    })
                    .catch(console.error)
            }
        })
        exec(`rm -rf ${path}/.terraform`)
            .then((() => console.log("Deleted .terraform plugin folder.")))
            .catch(console.error)
    })

}

const getInstances = async (prefix) => {
    const compute = new Compute()
    return compute
        .getVMs({ filter: `name eq ^${prefix}.*` })
        .then(data => {

            let vms = data[0].map(element => element.metadata)
            let newVMs = vms.map(({ name, networkInterfaces }) => ({
                name,
                publicIP: networkInterfaces[0].accessConfigs[0].natIP,
                privateIP: networkInterfaces[0].networkIP
            }))

            // console.log(newVMs)

            return newVMs;
        })
        .catch(console.error)
}

const createTerraformVariableFile = async (body, resourceName) => {

    const { numberOfVm, instanceGroupName, cpu, memory, disk, osType, osImage, applicationType } = body

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

    if (process.env.USER) {
        instance['user'] = process.env.USER
    }

    fs.writeFileSync(`terraform/${resourceName}.auto.tfvars.json`, JSON.stringify(instance))
    console.log(`Created file terraform/${resourceName}.auto.tfvars.json from request...`)
}

const executeTerraform = async (resourceName) => {

        return exec(`make terraform-apply RESOURCE_NAME=${resourceName}`)

            // When success
            .then(async ({ stdout, stderr, error }) => {
                if (error) { console.error(error); return }

                // Log output
                if (stderr) console.log(`stderr: ${stderr}`)
                if (stdout) console.log(`stdout: ${stdout}`)
                return  
            })
            .catch(error => {
                console.error(error)
                return
            })
}

app.listen(PORT, () => {
    console.log('Listenning on port: ', PORT)
})