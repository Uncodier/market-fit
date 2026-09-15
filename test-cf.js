const domain = "mail.makinari.com"
const domainParts = domain.split('.')
let searchName = domain
if (domainParts.length > 2) {
  searchName = domainParts.slice(-2).join('.') 
}
console.log(searchName)
