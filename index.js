const express = require("express");
const cors = require("cors");
const fs = require("fs");
const Compute = require("@google-cloud/compute");
const { Storage } = require("@google-cloud/storage");
const util = require("util");
const exec = util.promisify(require("child_process").exec);

const PORT = process.env.PORT || 5000;
const WAIT_BEFORE_EXECUTE = 3000; // wait 6 seconds

const app = express();

const templateRepository = "template_repository";
const templateRegistry = "template_registry";

app.use(cors());
app.use(express.json());

const getName = (str) => str.split("/")[1];
const getPath = (str) => str.substring(str.lastIndexOf("/") + 1);

app.post("/", async (req, res) => {
  try {
    const { instanceGroupName, stack } = req.body;

    let files = [
      "terraform/google/dev/main.tf",
      "terraform/google/dev/variables.tf",
    ];

    let modules = [];

    switch (stack) {
      case "mern":
        modules = {
          frontend: "modules/react/dev/init-react.sh",
          backend: "modules/nodejs/dev/init-nodejs.sh",
          database: "modules/mongodb/init-mongodb.sh",
        };
        break;

      case "sbam":
        modules = {
          frontend: "modules/angular/dev/init-angular.sh",
          backend: "modules/springboot/dev/init-springboot.sh",
          database: "modules/mysql/init-mysql.sh",
        };
        break;

      default:
        break;
    }

    for ([key, value] of Object.entries(modules)) {
      files.push(value);
    }

    // Replace hyphens by underscores
    // let resourceName = instanceGroupName
    //   .replace(/-/g, "_")
    //   .trim()
    //   .toLowerCase();
    // let folders = "backend"
    let timestamp = Date.now();

    // Download the files
    downloadFiles(files, "./terraform/");

    // Wait 3 seconds for the download
    setTimeout(() => {
      createTerraformVariableFile(req.body, modules);

      executeTerraform(instanceGroupName)
        .then(async () => {
          // Export the generated terraform directory to template registry
          uploadFiles(instanceGroupName, timestamp);

          // Get VM Instances
          getInstances(instanceGroupName)
            .then((instances) => {
              console.log(instances);
              res.send(instances);
            })
            .catch(console.error);
        })
        .catch((error) => {
          console.error(error);
          res.status(500).send("Error during creation.");
        });
    }, WAIT_BEFORE_EXECUTE);
  } catch (error) {
    console.error(error);
    res.status(500).send("Server error.");
  }
});

const downloadFiles = (filesToDowload, path) => {
  // Creates a client
  const storage = new Storage();

  filesToDowload.map(async (file) => {
    let destination = `${path}/${file.substring(file.lastIndexOf("/") + 1)}`;
    try {
      await storage
        .bucket(templateRepository)
        .file(file)
        .download({ destination });
      console.log(
        `gs://${templateRepository}/${file} downloaded to ${destination}.`
      );
    } catch (error) {
      console.error(error);
    }
  });
};

const uploadFiles = async (instanceGroupName, timestamp) => {
  const storage = new Storage();

  let path = `terraform`;

  return fs.readdir(path, async (err, directoryContent) => {
    if (err) {
      console.error(err);
      return;
    }

    console.log("TIMESTAMP:", timestamp);

    // Import and remove each file one by one
    directoryContent.forEach((file) => {
      if (!fs.statSync(`${path}/${file}`).isDirectory()) {
        let destination = `${instanceGroupName}-${timestamp}/${file}`;
        storage
          .bucket(templateRegistry)
          .upload(`${path}/${file}`, { destination })
          .then(async () => {
            console.log(`${file} uploaded successfuly`);
            // exec(`rm -rf ${path}/${file}`)
            //   .then(() => console.log(`Deleted ${file}.`))
            //   .catch(console.error);
          })
          .catch(console.error);
      }
    });
    // exec(`rm -rf ${path}/.terraform`)
    //   .then(() => console.log("Deleted .terraform plugin folder."))
    //   .catch(console.error);
  });
};

const getInstances = async (prefix) => {
  const compute = new Compute();
  return compute
    .getVMs({ filter: `name eq ^${prefix}.*` })
    .then((data) => {
      let vms = data[0].map((element) => element.metadata);
      let newVMs = vms.map(({ name, networkInterfaces }) => ({
        name,
        publicIP: networkInterfaces[0].accessConfigs[0].natIP,
        privateIP: networkInterfaces[0].networkIP,
      }));

      // console.log(newVMs)

      return newVMs;
    })
    .catch(console.error);
};

const createTerraformVariableFile = async (body, modules) => {
  const {
    numberOfVm,
    instanceGroupName,
    cpu,
    memory,
    disk,
    osType,
    osImage,
    applicationType,
  } = body;

  let instance = {
    number_of_vm: numberOfVm,
    vm_group_name: instanceGroupName,
    cpu: cpu,
    memory: memory,
    disk_size_gb: disk,
    image_project: osType,
    image_family: osImage,
    application_type: applicationType,
    region: "europe-west6",
    zone: "europe-west6-a",
  };

  if (process.env.USER) {
    instance["user"] = process.env.USER;
  }

  for ([key, value] of Object.entries(modules)) {
    instance[key] = { name: getName(value), path: getPath(value) };
  }

  fs.writeFileSync(
    `terraform/${instanceGroupName}.auto.tfvars.json`,
    JSON.stringify(instance)
  );
  console.log(
    `Created file terraform/${instanceGroupName}.auto.tfvars.json from request...`
  );
};

const executeTerraform = async (resourceName) => {
  return (
    exec(`make terraform-apply RESOURCE_NAME=${resourceName}`)
      // When success
      .then(async ({ stdout, stderr, error }) => {
        if (error) {
          console.error(error);
          return;
        }

        // Log output
        if (stderr) console.log(`stderr: ${stderr}`);
        if (stdout) console.log(`stdout: ${stdout}`);
        return;
      })
      .catch((error) => {
        console.error(error);
        return;
      })
  );
};

app.listen(PORT, () => {
  console.log("Listenning on port: ", PORT);
});
