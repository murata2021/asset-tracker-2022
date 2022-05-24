module.exports=function UnauthorizedError(){
    this.status=401,
    this.message="Unauthorized"
}