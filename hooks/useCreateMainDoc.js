import { useCMS, usePlugins } from "tinacms"
import { useRouter } from "next/router"
import slugify from "slugify"

import { toMarkdownString, flatDocs } from "@utils"

const useCreateMainDoc = (allDocs) => {
  const router = useRouter()
  const cms = useCMS()
  usePlugins([
    {
      __type: "content-creator",
      name: "Create Main Doc Page",
      fields: [
        {
          name: "title",
          label: "Title",
          component: "text",
          required: true,
          validate(value, allValues, meta, field) {
            if (!value) {
              return "A title is required"
            }
            let valSlug = `${slugify(value, { lower: true })}`
            // make sure slug is unique
            const slugMatches = (el) => {
              return el.slug === valSlug
            }
            // some function reference can be found here
            // https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Array/some
            const validTitle = !flatDocs(allDocs).some(slugMatches)
            if (!validTitle) return "titles must be unique, maybe add a number to the end?"
          },
        },
      ],
      onSubmit: async ({ title }) => {
        const slug = slugify(title, { lower: true })

        // get json file from github
        const configFile = await cms.api.github.fetchFile("docs/config.json", null)
        const sha = configFile.sha
        const allNestedDocsRemote = JSON.parse(configFile.decodedContent)
        const fileRelativePath = `docs/${slug}.md`

        // add the new file to the begining of the array (This will also be the begining of the navigation)
        allNestedDocsRemote.config.unshift({
          type: "link",
          slug: slug,
          title,
          children: [],
        })

        // commit the config file to github
        await cms.api.github
          .commit(
            "docs/config.json",
            sha,
            JSON.stringify(allNestedDocsRemote),
            "Update from TinaCMS"
          )
          .then((response) => {
            setCachedFormData("docs/config", {
              sha: response.content.sha,
            })
          })

        // commit the markdown file to github
        return await cms.api.github
          .commit(
            fileRelativePath,
            getCachedFormData(fileRelativePath).sha,
            toMarkdownString({
              fileRelativePath,
              rawFrontmatter: {
                title,
              },
            }),
            "Update from TinaCMS"
          )
          .then((response) => {
            setCachedFormData(fileRelativePath, {
              sha: response.content.sha,
            })
            setTimeout(() => router.push(`/docs/${slug}`), 1500)
          })
          .catch((e) => {
            return { [FORM_ERROR]: e }
          })
      },
    },
  ])
}

const getCachedFormData = (id) => {
  if (typeof localStorage === "undefined") {
    return {}
  }
  return JSON.parse(localStorage.getItem(id) || "{}")
}

const setCachedFormData = (id, data) => {
  if (typeof localStorage === "undefined") {
    return
  }
  localStorage.setItem(id, JSON.stringify(data))
}

export default useCreateMainDoc
